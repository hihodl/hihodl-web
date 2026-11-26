/**
 * The undo login email page's words, in the account holder's language.
 *
 * The email's link carries `?l=` (the backend's `users.locale`, resolved to
 * one of these); without it the page follows the browser's languages, else
 * English. Same 17 languages as the backend's mail (login-email-copy.ts), so
 * the page reads like the email that sent the person here. Pure.
 */

export const UNDO_LOCALES = [
  "en", "es-ES", "pt-BR", "fr", "de", "it", "nl", "tr", "ar-AE",
  "hi", "id", "ja", "ko", "sw", "th", "vi", "zh-CN",
] as const;
export type UndoLocale = (typeof UNDO_LOCALES)[number];

export type UndoKey =
  | "eyebrow" | "checking" | "askTitle" | "changedTo" | "undoing" | "undoIt" | "tryAgain"
  | "doneTitle" | "doneLine" | "already" | "expired" | "taken" | "invalid" | "contact"
  | "noteAgain" | "noteLater";

/** One tag to ours: exact first, then by language (es-MX reads es-ES, pt-PT reads pt-BR). */
export function resolveUndoLocale(raw: string | null | undefined): UndoLocale | null {
  if (!raw) return null;
  const tag = raw.trim().replace(/_/g, "-").toLowerCase();
  const exact = UNDO_LOCALES.find((l) => l.toLowerCase() === tag);
  if (exact) return exact;
  const lang = tag.split("-")[0];
  return UNDO_LOCALES.find((l) => l.split("-")[0].toLowerCase() === lang) ?? null;
}

/** `?l=` first, then the browser's own list, then English. */
export function pickUndoLocale(search: string, browser: readonly string[]): UndoLocale {
  let fromLink: string | null = null;
  try {
    fromLink = new URLSearchParams(search).get("l");
  } catch {
    /* no link language */
  }
  const resolved = resolveUndoLocale(fromLink);
  if (resolved) return resolved;
  for (const b of browser) {
    const r = resolveUndoLocale(b);
    if (r) return r;
  }
  return "en";
}

export const UNDO_COPY: Record<UndoLocale, Record<UndoKey, string>> = {
  en: {
    eyebrow: "Login email", checking: "Checking the link…", askTitle: "Undo the login email change?",
    changedTo: "Your login email was changed to {email}.", undoing: "Undoing…", undoIt: "Undo it", tryAgain: "Try again",
    doneTitle: "Change undone. Every device was signed out.", doneLine: "Sign in again with this address in HOLD.",
    already: "This change was already undone.", expired: "This link expired.", taken: "This change can’t be undone here.",
    invalid: "This link is not valid.", contact: "Contact", noteAgain: "That did not go through. Try again.",
    noteLater: "Too many tries. Try again later.",
  },
  "es-ES": {
    eyebrow: "Email de acceso", checking: "Comprobando el enlace…", askTitle: "¿Deshacer el cambio del email de acceso?",
    changedTo: "Tu email de acceso se cambió a {email}.", undoing: "Deshaciendo…", undoIt: "Deshacer el cambio", tryAgain: "Reintentar",
    doneTitle: "Cambio deshecho. Se ha cerrado la sesión en todos los dispositivos.", doneLine: "Vuelve a iniciar sesión en HOLD con esta dirección.",
    already: "Este cambio ya se había deshecho.", expired: "Este enlace ha caducado.", taken: "Este cambio no se puede deshacer aquí.",
    invalid: "Este enlace no es válido.", contact: "Escribe a", noteAgain: "No ha funcionado. Inténtalo de nuevo.",
    noteLater: "Demasiados intentos. Inténtalo más tarde.",
  },
  "pt-BR": {
    eyebrow: "E-mail de acesso", checking: "Verificando o link…", askTitle: "Desfazer a alteração do e-mail de acesso?",
    changedTo: "Seu e-mail de acesso foi alterado para {email}.", undoing: "Desfazendo…", undoIt: "Desfazer", tryAgain: "Tentar de novo",
    doneTitle: "Alteração desfeita. Todos os dispositivos foram desconectados.", doneLine: "Entre novamente na HOLD com este endereço.",
    already: "Esta alteração já foi desfeita.", expired: "Este link expirou.", taken: "Esta alteração não pode ser desfeita aqui.",
    invalid: "Este link não é válido.", contact: "Fale com", noteAgain: "Não deu certo. Tente de novo.",
    noteLater: "Muitas tentativas. Tente mais tarde.",
  },
  fr: {
    eyebrow: "E-mail de connexion", checking: "Vérification du lien…", askTitle: "Annuler le changement d'e-mail de connexion ?",
    changedTo: "Votre e-mail de connexion a été changé en {email}.", undoing: "Annulation…", undoIt: "Annuler le changement", tryAgain: "Réessayer",
    doneTitle: "Changement annulé. Tous les appareils ont été déconnectés.", doneLine: "Reconnectez-vous à HOLD avec cette adresse.",
    already: "Ce changement a déjà été annulé.", expired: "Ce lien a expiré.", taken: "Ce changement ne peut pas être annulé ici.",
    invalid: "Ce lien n'est pas valide.", contact: "Contactez", noteAgain: "Cela n'a pas fonctionné. Réessayez.",
    noteLater: "Trop de tentatives. Réessayez plus tard.",
  },
  de: {
    eyebrow: "Login-E-Mail", checking: "Link wird geprüft…", askTitle: "Änderung der Login-E-Mail rückgängig machen?",
    changedTo: "Deine Login-E-Mail wurde in {email} geändert.", undoing: "Wird rückgängig gemacht…", undoIt: "Rückgängig machen", tryAgain: "Erneut versuchen",
    doneTitle: "Änderung rückgängig gemacht. Alle Geräte wurden abgemeldet.", doneLine: "Melde dich mit dieser Adresse erneut bei HOLD an.",
    already: "Diese Änderung wurde bereits rückgängig gemacht.", expired: "Dieser Link ist abgelaufen.", taken: "Diese Änderung kann hier nicht rückgängig gemacht werden.",
    invalid: "Dieser Link ist ungültig.", contact: "Kontakt:", noteAgain: "Das hat nicht geklappt. Versuch es erneut.",
    noteLater: "Zu viele Versuche. Versuch es später erneut.",
  },
  it: {
    eyebrow: "Email di accesso", checking: "Verifica del link…", askTitle: "Annullare la modifica dell'email di accesso?",
    changedTo: "La tua email di accesso è stata cambiata in {email}.", undoing: "Annullamento…", undoIt: "Annulla la modifica", tryAgain: "Riprova",
    doneTitle: "Modifica annullata. Tutti i dispositivi sono stati disconnessi.", doneLine: "Accedi di nuovo a HOLD con questo indirizzo.",
    already: "Questa modifica è già stata annullata.", expired: "Questo link è scaduto.", taken: "Questa modifica non può essere annullata qui.",
    invalid: "Questo link non è valido.", contact: "Scrivi a", noteAgain: "Non è andato a buon fine. Riprova.",
    noteLater: "Troppi tentativi. Riprova più tardi.",
  },
  nl: {
    eyebrow: "Inlog-e-mail", checking: "Link controleren…", askTitle: "Wijziging van je inlog-e-mail ongedaan maken?",
    changedTo: "Je inlog-e-mail is gewijzigd naar {email}.", undoing: "Ongedaan maken…", undoIt: "Ongedaan maken", tryAgain: "Opnieuw proberen",
    doneTitle: "Wijziging ongedaan gemaakt. Elk apparaat is uitgelogd.", doneLine: "Log opnieuw in bij HOLD met dit adres.",
    already: "Deze wijziging is al ongedaan gemaakt.", expired: "Deze link is verlopen.", taken: "Deze wijziging kan hier niet ongedaan worden gemaakt.",
    invalid: "Deze link is niet geldig.", contact: "Neem contact op met", noteAgain: "Dat is niet gelukt. Probeer het opnieuw.",
    noteLater: "Te veel pogingen. Probeer het later opnieuw.",
  },
  tr: {
    eyebrow: "Giriş e-postası", checking: "Bağlantı kontrol ediliyor…", askTitle: "Giriş e-postası değişikliği geri alınsın mı?",
    changedTo: "Giriş e-postan {email} olarak değiştirildi.", undoing: "Geri alınıyor…", undoIt: "Geri al", tryAgain: "Tekrar dene",
    doneTitle: "Değişiklik geri alındı. Tüm cihazlarda oturum kapatıldı.", doneLine: "Bu adresle HOLD'a yeniden giriş yap.",
    already: "Bu değişiklik zaten geri alındı.", expired: "Bu bağlantının süresi doldu.", taken: "Bu değişiklik burada geri alınamaz.",
    invalid: "Bu bağlantı geçerli değil.", contact: "İletişim:", noteAgain: "Olmadı. Tekrar dene.",
    noteLater: "Çok fazla deneme. Daha sonra tekrar dene.",
  },
  "ar-AE": {
    eyebrow: "بريد تسجيل الدخول", checking: "جارٍ التحقق من الرابط…", askTitle: "التراجع عن تغيير بريد تسجيل الدخول؟",
    changedTo: "تم تغيير بريد تسجيل الدخول إلى {email}.", undoing: "جارٍ التراجع…", undoIt: "تراجع عن التغيير", tryAgain: "حاول مجددًا",
    doneTitle: "تم التراجع عن التغيير. تم تسجيل الخروج من كل الأجهزة.", doneLine: "سجّل الدخول مجددًا إلى HOLD بهذا العنوان.",
    already: "تم التراجع عن هذا التغيير مسبقًا.", expired: "انتهت صلاحية هذا الرابط.", taken: "لا يمكن التراجع عن هذا التغيير هنا.",
    invalid: "هذا الرابط غير صالح.", contact: "تواصل مع", noteAgain: "لم ينجح ذلك. حاول مجددًا.",
    noteLater: "محاولات كثيرة. حاول لاحقًا.",
  },
  hi: {
    eyebrow: "लॉगिन ईमेल", checking: "लिंक की जाँच हो रही है…", askTitle: "लॉगिन ईमेल का बदलाव वापस लें?",
    changedTo: "आपका लॉगिन ईमेल {email} में बदल दिया गया।", undoing: "वापस लिया जा रहा है…", undoIt: "बदलाव वापस लें", tryAgain: "फिर से कोशिश करें",
    doneTitle: "बदलाव वापस ले लिया गया। हर डिवाइस से साइन आउट कर दिया गया।", doneLine: "इसी पते से HOLD में फिर से साइन इन करें।",
    already: "यह बदलाव पहले ही वापस लिया जा चुका है।", expired: "इस लिंक की अवधि समाप्त हो गई।", taken: "यह बदलाव यहाँ वापस नहीं लिया जा सकता।",
    invalid: "यह लिंक मान्य नहीं है।", contact: "संपर्क करें:", noteAgain: "यह नहीं हो पाया। फिर से कोशिश करें।",
    noteLater: "बहुत ज़्यादा कोशिशें। बाद में कोशिश करें।",
  },
  id: {
    eyebrow: "Email login", checking: "Memeriksa tautan…", askTitle: "Batalkan perubahan email login?",
    changedTo: "Email login kamu diubah menjadi {email}.", undoing: "Membatalkan…", undoIt: "Batalkan perubahan", tryAgain: "Coba lagi",
    doneTitle: "Perubahan dibatalkan. Semua perangkat telah dikeluarkan.", doneLine: "Masuk lagi ke HOLD dengan alamat ini.",
    already: "Perubahan ini sudah dibatalkan.", expired: "Tautan ini sudah kedaluwarsa.", taken: "Perubahan ini tidak bisa dibatalkan di sini.",
    invalid: "Tautan ini tidak valid.", contact: "Hubungi", noteAgain: "Itu tidak berhasil. Coba lagi.",
    noteLater: "Terlalu banyak percobaan. Coba lagi nanti.",
  },
  ja: {
    eyebrow: "ログイン用メールアドレス", checking: "リンクを確認しています…", askTitle: "ログイン用メールアドレスの変更を取り消しますか？",
    changedTo: "ログイン用メールアドレスが {email} に変更されました。", undoing: "取り消しています…", undoIt: "変更を取り消す", tryAgain: "もう一度試す",
    doneTitle: "変更を取り消しました。すべてのデバイスからログアウトしました。", doneLine: "このアドレスでHOLDに再度ログインしてください。",
    already: "この変更はすでに取り消されています。", expired: "このリンクは有効期限が切れています。", taken: "この変更はここでは取り消せません。",
    invalid: "このリンクは無効です。", contact: "お問い合わせ:", noteAgain: "うまくいきませんでした。もう一度お試しください。",
    noteLater: "試行回数が多すぎます。しばらくしてからお試しください。",
  },
  ko: {
    eyebrow: "로그인 이메일", checking: "링크 확인 중…", askTitle: "로그인 이메일 변경을 취소할까요?",
    changedTo: "로그인 이메일이 {email}(으)로 변경되었습니다.", undoing: "취소 중…", undoIt: "변경 취소", tryAgain: "다시 시도",
    doneTitle: "변경이 취소되었습니다. 모든 기기에서 로그아웃되었습니다.", doneLine: "이 주소로 HOLD에 다시 로그인하세요.",
    already: "이 변경은 이미 취소되었습니다.", expired: "이 링크는 만료되었습니다.", taken: "이 변경은 여기서 취소할 수 없습니다.",
    invalid: "유효하지 않은 링크입니다.", contact: "문의:", noteAgain: "처리되지 않았습니다. 다시 시도하세요.",
    noteLater: "시도 횟수가 너무 많습니다. 나중에 다시 시도하세요.",
  },
  sw: {
    eyebrow: "Barua pepe ya kuingia", checking: "Inakagua kiungo…", askTitle: "Tendua mabadiliko ya barua pepe ya kuingia?",
    changedTo: "Barua pepe yako ya kuingia ilibadilishwa kuwa {email}.", undoing: "Inatendua…", undoIt: "Tendua", tryAgain: "Jaribu tena",
    doneTitle: "Mabadiliko yametenduliwa. Kila kifaa kimetolewa.", doneLine: "Ingia tena kwenye HOLD kwa anwani hii.",
    already: "Mabadiliko haya yalishatenduliwa.", expired: "Kiungo hiki kimeisha muda.", taken: "Mabadiliko haya hayawezi kutenduliwa hapa.",
    invalid: "Kiungo hiki si halali.", contact: "Wasiliana na", noteAgain: "Haikufaulu. Jaribu tena.",
    noteLater: "Majaribio mengi mno. Jaribu baadaye.",
  },
  th: {
    eyebrow: "อีเมลสำหรับเข้าสู่ระบบ", checking: "กำลังตรวจสอบลิงก์…", askTitle: "ยกเลิกการเปลี่ยนอีเมลสำหรับเข้าสู่ระบบไหม",
    changedTo: "อีเมลสำหรับเข้าสู่ระบบของคุณถูกเปลี่ยนเป็น {email}", undoing: "กำลังยกเลิก…", undoIt: "ยกเลิกการเปลี่ยน", tryAgain: "ลองอีกครั้ง",
    doneTitle: "ยกเลิกการเปลี่ยนแล้ว ออกจากระบบในทุกอุปกรณ์แล้ว", doneLine: "เข้าสู่ระบบ HOLD อีกครั้งด้วยที่อยู่นี้",
    already: "การเปลี่ยนนี้ถูกยกเลิกไปแล้ว", expired: "ลิงก์นี้หมดอายุแล้ว", taken: "ไม่สามารถยกเลิกการเปลี่ยนนี้ที่นี่ได้",
    invalid: "ลิงก์นี้ไม่ถูกต้อง", contact: "ติดต่อ", noteAgain: "ไม่สำเร็จ ลองอีกครั้ง",
    noteLater: "ลองหลายครั้งเกินไป ลองใหม่ภายหลัง",
  },
  vi: {
    eyebrow: "Email đăng nhập", checking: "Đang kiểm tra liên kết…", askTitle: "Hoàn tác thay đổi email đăng nhập?",
    changedTo: "Email đăng nhập của bạn đã được đổi thành {email}.", undoing: "Đang hoàn tác…", undoIt: "Hoàn tác", tryAgain: "Thử lại",
    doneTitle: "Đã hoàn tác thay đổi. Mọi thiết bị đã được đăng xuất.", doneLine: "Hãy đăng nhập lại vào HOLD bằng địa chỉ này.",
    already: "Thay đổi này đã được hoàn tác.", expired: "Liên kết này đã hết hạn.", taken: "Không thể hoàn tác thay đổi này tại đây.",
    invalid: "Liên kết này không hợp lệ.", contact: "Liên hệ", noteAgain: "Không thành công. Hãy thử lại.",
    noteLater: "Thử quá nhiều lần. Hãy thử lại sau.",
  },
  "zh-CN": {
    eyebrow: "登录邮箱", checking: "正在检查链接…", askTitle: "撤销登录邮箱的更改？",
    changedTo: "你的登录邮箱已更改为 {email}。", undoing: "正在撤销…", undoIt: "撤销更改", tryAgain: "重试",
    doneTitle: "已撤销更改。所有设备均已退出登录。", doneLine: "请用此邮箱重新登录 HOLD。",
    already: "此更改已被撤销。", expired: "此链接已过期。", taken: "此更改无法在这里撤销。",
    invalid: "此链接无效。", contact: "联系", noteAgain: "未成功，请重试。",
    noteLater: "尝试次数过多，请稍后再试。",
  },
};
