/**
 * The 10 launch countries per doc 15.
 *
 * Each entry carries the regulatory context needed at signup time
 * (default language, currency, data residency region, primary compliance
 * frameworks).
 */

import type { Region } from "../types/workspace.js";

export interface CountryMeta {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  default_language: string; // BCP47
  default_currency: string; // ISO 4217
  data_residency_region: Region;
  /** Top-level compliance frameworks that apply. */
  compliance_frameworks: readonly string[];
  /** Telephony rules a workspace in this country inherits. */
  telephony: {
    requires_brand_registration: boolean;
    primary_regulator: string;
  };
}

export const COUNTRIES: readonly CountryMeta[] = [
  {
    code: "US",
    name: "United States",
    default_language: "en-US",
    default_currency: "USD",
    data_residency_region: "us-east-1",
    compliance_frameworks: ["FTC", "TCPA", "CAN-SPAM", "CCPA", "HIPAA-conditional", "DPF"],
    telephony: { requires_brand_registration: true, primary_regulator: "FCC" },
  },
  {
    code: "GB",
    name: "United Kingdom",
    default_language: "en-GB",
    default_currency: "GBP",
    data_residency_region: "eu-west-1",
    compliance_frameworks: ["UK-GDPR", "PECR", "CAP-Code", "ASA"],
    telephony: { requires_brand_registration: false, primary_regulator: "Ofcom" },
  },
  {
    code: "CA",
    name: "Canada",
    default_language: "en-US",
    default_currency: "CAD",
    data_residency_region: "us-east-1",
    compliance_frameworks: ["PIPEDA", "CASL", "Quebec-Law-25"],
    telephony: { requires_brand_registration: true, primary_regulator: "CRTC" },
  },
  {
    code: "AU",
    name: "Australia",
    default_language: "en-GB",
    default_currency: "AUD",
    data_residency_region: "ap-southeast-2",
    compliance_frameworks: ["Privacy-Act", "Spam-Act", "ACMA"],
    telephony: { requires_brand_registration: false, primary_regulator: "ACMA" },
  },
  {
    code: "MX",
    name: "Mexico",
    default_language: "es-MX",
    default_currency: "MXN",
    data_residency_region: "us-east-1",
    compliance_frameworks: ["LFPDPPP", "PROFECO"],
    telephony: { requires_brand_registration: false, primary_regulator: "IFT" },
  },
  {
    code: "BR",
    name: "Brazil",
    default_language: "pt-BR",
    default_currency: "BRL",
    data_residency_region: "sa-east-1",
    compliance_frameworks: ["LGPD", "CDC", "CONAR"],
    telephony: { requires_brand_registration: false, primary_regulator: "Anatel" },
  },
  {
    code: "DE",
    name: "Germany",
    default_language: "de-DE",
    default_currency: "EUR",
    data_residency_region: "eu-central-1",
    compliance_frameworks: ["GDPR", "TTDSG", "UWG"],
    telephony: { requires_brand_registration: false, primary_regulator: "BNetzA" },
  },
  {
    code: "FR",
    name: "France",
    default_language: "fr-FR",
    default_currency: "EUR",
    data_residency_region: "eu-west-1",
    compliance_frameworks: ["GDPR", "CNIL", "Loi-Informatique"],
    telephony: { requires_brand_registration: false, primary_regulator: "ARCEP" },
  },
  {
    code: "IN",
    name: "India",
    default_language: "hi-IN",
    default_currency: "INR",
    data_residency_region: "ap-south-1",
    compliance_frameworks: ["DPDP-Act-2023", "IT-Rules-2021"],
    telephony: { requires_brand_registration: true, primary_regulator: "TRAI" },
  },
  {
    code: "JP",
    name: "Japan",
    default_language: "ja-JP",
    default_currency: "JPY",
    data_residency_region: "ap-southeast-2",
    compliance_frameworks: ["APPI", "Specified-Commercial-Transactions-Act"],
    telephony: { requires_brand_registration: false, primary_regulator: "MIC" },
  },
] as const;

export const COUNTRIES_BY_CODE: Readonly<Record<string, CountryMeta>> = Object.freeze(
  Object.fromEntries(COUNTRIES.map((c) => [c.code, c]))
);

export function getCountry(code: string): CountryMeta | undefined {
  return COUNTRIES_BY_CODE[code];
}
