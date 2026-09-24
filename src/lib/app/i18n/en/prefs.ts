/** English: the source of the "prefs" namespace (the Language and Currency pickers). */
const prefs = {
  language: "Language",
  currency: "Currency",
  recentLanguages: "Recent languages",
  allLanguages: "All languages",
  searchLanguage: "Search language",
  recentCurrencies: "Recent currencies",
  allCurrencies: "All currencies",
  searchCurrency: "Search currency or country",
  currencyIntro: "Balances, totals and prices are shown in this currency. What you actually pay stays in the token, and a group keeps its own currency.",
  currencyNoRate: "* No live exchange rate yet, so amounts stay in US dollars.",
  currencyNoRateLabel: "{code} {name}, live exchange rate unavailable",
} satisfies Record<string, string>;

export default prefs;
