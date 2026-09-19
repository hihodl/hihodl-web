/**
 * The passkey ceremonies the web wallet runs, with the PRF extension.
 *
 * rpId is "hihodl.xyz", the app's, so a passkey made in the HOLD app and one
 * made here are the same credentials in iCloud Keychain or Google Password
 * Manager. That only works on an origin under hihodl.xyz: on localhost or a
 * Vercel preview every ceremony is refused by the browser (see passkeysHere).
 *
 * Registration goes through the backend's existing /passkeys routes, so the
 * new passkey is also a sign-in passkey for the account. An ASSERTION for the
 * wallet never goes to the server: it exists only to make the authenticator
 * evaluate PRF, and its challenge is local randomness. Nothing about the
 * wallet's security rests on the server checking it — without the passkey
 * there is no PRF output, and without that output no wrapping opens.
 *
 * Every ceremony has to start inside the click that asked for it (Safari
 * refuses a create() that follows a network round trip), so the callers fetch
 * what they need first and call these from the button's handler directly.
 */

"use client";

import { fromBase64, prfSaltBytes, randomBytes, toBase64Url } from "./core";
import type { RegistrationOptionsJSON } from "./api";

export const RP_ID = "hihodl.xyz";

export class PasskeyError extends Error {
  constructor(
    readonly code:
      | "unavailable" // no WebAuthn here, or not an origin under hihodl.xyz
      | "cancelled" // the person closed the sheet, or it timed out
      | "exists" // this authenticator already holds a passkey for the account
      | "no_prf" // the passkey provider does not do PRF: nothing may be wrapped with it
      | "failed",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PasskeyError";
  }
}

/** Can a ceremony for rpId hihodl.xyz run on this page at all? */
export function passkeysHere(): boolean {
  if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
  const h = window.location.hostname;
  return window.isSecureContext && (h === RP_ID || h.endsWith(`.${RP_ID}`));
}

function asBytes(v: unknown): Uint8Array | null {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
  return null;
}

function mapError(e: unknown): PasskeyError {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return new PasskeyError("cancelled");
  if (name === "InvalidStateError") return new PasskeyError("exists");
  if (name === "SecurityError" || name === "NotSupportedError") return new PasskeyError("unavailable");
  return new PasskeyError("failed", (e as Error)?.message);
}

interface PrfOutputs {
  enabled?: boolean;
  results?: { first?: ArrayBuffer | ArrayBufferView };
}

function prfOf(cred: PublicKeyCredential): PrfOutputs | undefined {
  return (cred.getClientExtensionResults() as { prf?: PrfOutputs }).prf;
}

export interface CreatedPasskey {
  credentialId: string;
  /** Some browsers (Chrome with Google Password Manager) evaluate PRF at creation; Safari only reports `enabled`. */
  prf: Uint8Array | null;
  /** Whether the provider said this passkey does PRF (it can open a web wallet). */
  prfEnabled: boolean;
  /** The registration, ready for POST /passkeys/register/complete. */
  registration: {
    id: string;
    rawId: string;
    type: "public-key";
    response: { clientDataJSON: string; attestationObject: string };
  };
}

/**
 * Create a passkey asking for PRF. Refuses (no_prf) BEFORE anything is sent
 * to the server when the provider says PRF is off: that passkey could never
 * open a wallet, and the caller writes nothing.
 *
 * `requirePrf: false` is for a passkey that signs in and nothing more
 * (onboarding's passkey step): it is still asked for PRF, and `prfEnabled`
 * says whether it came, but a provider without PRF is not a refusal there.
 */
export async function createPasskeyWithPrf(
  options: RegistrationOptionsJSON,
  { requirePrf = true }: { requirePrf?: boolean } = {},
): Promise<CreatedPasskey> {
  if (!passkeysHere()) throw new PasskeyError("unavailable");
  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: fromBase64(options.challenge),
    rp: { name: options.rp.name, id: RP_ID },
    user: { id: fromBase64(options.user.id), name: options.user.name, displayName: options.user.displayName },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout ?? 60000,
    attestation: "none",
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
    excludeCredentials: (options.excludeCredentials ?? []).map((c) => ({ type: "public-key" as const, id: fromBase64(c.id) })),
    extensions: { prf: { eval: { first: prfSaltBytes() } } } as AuthenticationExtensionsClientInputs,
  };

  let cred: PublicKeyCredential;
  try {
    const got = await navigator.credentials.create({ publicKey });
    if (!got) throw new PasskeyError("cancelled");
    cred = got as PublicKeyCredential;
  } catch (e) {
    throw e instanceof PasskeyError ? e : mapError(e);
  }

  const prf = prfOf(cred);
  const first = asBytes(prf?.results?.first);
  const prfEnabled = prf?.enabled === true || !!first;
  if (requirePrf && !prfEnabled) throw new PasskeyError("no_prf");

  const res = cred.response as AuthenticatorAttestationResponse;
  return {
    credentialId: cred.id,
    prf: first,
    prfEnabled,
    registration: {
      id: cred.id,
      rawId: toBase64Url(new Uint8Array(cred.rawId)),
      type: "public-key",
      response: {
        clientDataJSON: toBase64Url(new Uint8Array(res.clientDataJSON)),
        attestationObject: toBase64Url(new Uint8Array(res.attestationObject)),
      },
    },
  };
}

export interface PrfAssertion {
  credentialId: string;
  prf: Uint8Array;
}

/**
 * Ask one of `credentialIds` for its PRF output. The person picks which
 * passkey if there are several; the returned id says which one answered.
 */
export async function evaluatePrf(credentialIds: readonly string[]): Promise<PrfAssertion> {
  if (!passkeysHere()) throw new PasskeyError("unavailable");
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: randomBytes(32),
    rpId: RP_ID,
    allowCredentials: credentialIds.map((id) => ({ type: "public-key" as const, id: fromBase64(id) })),
    userVerification: "required",
    timeout: 60000,
    extensions: { prf: { eval: { first: prfSaltBytes() } } } as AuthenticationExtensionsClientInputs,
  };
  let cred: PublicKeyCredential;
  try {
    const got = await navigator.credentials.get({ publicKey });
    if (!got) throw new PasskeyError("cancelled");
    cred = got as PublicKeyCredential;
  } catch (e) {
    throw e instanceof PasskeyError ? e : mapError(e);
  }
  const first = asBytes(prfOf(cred)?.results?.first);
  if (!first || first.length !== 32) throw new PasskeyError("no_prf");
  return { credentialId: cred.id, prf: first };
}

/** Plain base64 ids from older rows, as the browser spells them. */
export function normalizeCredentialId(id: string): string {
  return id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The server's WebAuthn request options, as JSON (base64url ids and challenge). */
export interface ServerAssertionOptions {
  challenge: string;
  rpId?: string;
  timeout?: number;
  allowCredentials?: { id: string; type: "public-key"; transports?: string[] }[];
}

export interface BoundAssertion {
  credentialId: string;
  /** This passkey's PRF output: opens the wallet. Never sent anywhere; the caller wipes it. */
  prf: Uint8Array;
  /** The assertion for the server (@simplewebauthn/server's AuthenticationResponseJSON), without the PRF result. */
  assertion: {
    id: string;
    rawId: string;
    type: "public-key";
    response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string };
    clientExtensionResults: Record<string, never>;
  };
}

/**
 * ONE ceremony that does two things: signs the SERVER's challenge (which
 * binds the assertion to one withdrawal's exact bytes) and evaluates PRF
 * (which opens the wallet that signs them). So a withdrawal is one prompt.
 *
 * `onlyIds` narrows the server's list to the passkeys that open this wallet:
 * a passkey that signs in but has no wrapping could authorize and then fail
 * to sign.
 */
export async function assertWithPrf(options: ServerAssertionOptions, onlyIds: readonly string[]): Promise<BoundAssertion> {
  if (!passkeysHere()) throw new PasskeyError("unavailable");
  const wanted = new Set(onlyIds.map(normalizeCredentialId));
  const server = (options.allowCredentials ?? []).map((c) => normalizeCredentialId(c.id));
  const both = server.length ? server.filter((id) => wanted.has(id)) : [...wanted];
  const ids = both.length ? both : [...wanted];
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: fromBase64(options.challenge),
    rpId: RP_ID,
    allowCredentials: ids.map((id) => ({ type: "public-key" as const, id: fromBase64(id) })),
    userVerification: "required",
    timeout: options.timeout ?? 60000,
    extensions: { prf: { eval: { first: prfSaltBytes() } } } as AuthenticationExtensionsClientInputs,
  };
  let cred: PublicKeyCredential;
  try {
    const got = await navigator.credentials.get({ publicKey });
    if (!got) throw new PasskeyError("cancelled");
    cred = got as PublicKeyCredential;
  } catch (e) {
    throw e instanceof PasskeyError ? e : mapError(e);
  }
  const first = asBytes(prfOf(cred)?.results?.first);
  if (!first || first.length !== 32) throw new PasskeyError("no_prf");
  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: cred.id,
    prf: first,
    assertion: {
      id: cred.id,
      rawId: toBase64Url(new Uint8Array(cred.rawId)),
      type: "public-key",
      response: {
        clientDataJSON: toBase64Url(new Uint8Array(res.clientDataJSON)),
        authenticatorData: toBase64Url(new Uint8Array(res.authenticatorData)),
        signature: toBase64Url(new Uint8Array(res.signature)),
        ...(res.userHandle ? { userHandle: toBase64Url(new Uint8Array(res.userHandle)) } : {}),
      },
      clientExtensionResults: {},
    },
  };
}
