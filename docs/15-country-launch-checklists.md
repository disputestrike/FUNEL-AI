# FunelAI â€” Country-by-Country Launch Checklists

**Document:** 15-country-launch-checklists.md
**Owner:** VP International (hire by Month 2) â€” interim owner: COO
**Status:** Launch-ready playbook
**Scope:** 10 countries to support operationally at launch + first 12 months
**Launch languages (Day 1):** EN, ES, PT, FR, DE
**Last updated:** 2026-05-25

---

## How to use this document

Each country has 10 sections (Aâ€“J). The country owner runs every box in J first, then walks down Aâ†’I. Sections A (Legal) and C (Compliance) must be cleared by counsel before public launch in that country. Sections B, F, and H are engineering dependencies â€” schedule a 30-day lead with the platform team.

The "Pre-launch / Launch / 30-day / 90-day" phasing in section I is the canonical timeline. If a country slips on legal review, slip the whole country â€” do not soft-launch without local counsel sign-off.

---

# 1. United States

## A. Legal & Regulatory

- **Local counsel:** Cooley LLP or Wilson Sonsini (SaaS/AI specialist); secondary for TCPA defense â€” Klein Moynihan Turco LLP or Mac Murray Petersen Shuster LLP.
- **ToS / Privacy Policy:** Standard US ToS with California-specific addendum (CCPA/CPRA notice at collection, "Do Not Sell or Share My Personal Information" link, sensitive PI handling, financial incentive disclosures). Add Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), Texas (TDPSA), Oregon (OCPA), Montana (MCDPA), Delaware (DPDPA) addenda. Auto-renewal disclosure compliant with CA BPC Â§17602 and similar state laws (NY, NJ, IL, DC).
- **AI disclosure:** Federal â€” no comprehensive AI law yet, but FTC Section 5 on deceptive AI claims applies. State-level: CA AB 2013 (training data transparency), CA SB 942 (AI Transparency Act â€” provenance for generative output), Colorado AI Act (effective Feb 2026 â€” high-risk AI systems consequential decisions), Utah AI Policy Act (disclosure when consumer interacts with generative AI in regulated occupations), Texas TRAIGA. Disclose: "You are interacting with an AI" before any AI-generated voice/chat conversation initiates.
- **Telemarketing (TCPA-equivalent):** TCPA itself. Prior Express Written Consent (PEWC) required for any AI-generated or pre-recorded voice call AND for autodialed calls to wireless numbers. FCC 2024 ruling: AI-generated voice = "artificial voice" under TCPA â€” requires PEWC regardless of B2B/B2C. Check DNC registry (national + state). Establish internal DNC list. Time-of-day restrictions: 8amâ€“9pm recipient local time. State overlays: Florida Telephone Solicitation Act (FTSA), Oklahoma TCPA, Washington CEMA â€” broader than federal TCPA.
- **Anti-spam:** CAN-SPAM Act. No opt-in required, but: accurate header info, no deceptive subject lines, identification as ad, valid physical postal address, functional unsubscribe within 10 business days. California's stronger rules apply for CA residents.
- **Data protection:** No federal omnibus law. State patchwork â€” operate to the strictest (California CCPA/CPRA). FTC enforces deceptive privacy practices. HIPAA if any customer is a covered entity (need BAAs). GLBA for financial customers. COPPA for under-13.
- **Consumer rights:** Auto-renewal disclosure (CA, NY, IL, NJ, DC, OR). 3-day cooling off for door-to-door sales (FTC rule) â€” N/A for B2B SaaS but verify state law. CARD Act for credit cards.
- **Sector-specific:**
  - Medical/healthcare advertising â†’ FDA + FTC; state medical boards restrict telehealth lead-gen across state lines.
  - Legal â†’ state bar rules (e.g., NY DR 2-101, FL Bar Rule 4-7) on attorney advertising and lead-gen; some states (FL, NJ) restrict pay-per-lead.
  - Financial â€” TILA, MAP Rule, state mortgage advertising rules; CFPB on UDAAP.
  - Insurance â€” state-by-state DOI rules.
  - Cannabis â€” federal Schedule I; per-state advertising rules; payment processor restrictions.
  - Firearms, gambling, payday lending, MLM, adult â€” restricted use cases per AUP.
- **Local entity:** Delaware C-Corp (assumed primary entity). Sales tax registration in all economic nexus states post-Wayfair ($100K revenue or 200 txns threshold per state â€” varies). Register as foreign entity in states with physical/employee presence.

## B. Payment Rails

- **Primary rail:** Stripe (USD). Secondary: PayPal. ACH via Stripe for annual contracts >$2,400. Wire for enterprise.
- **Currency:** USD. Base pricing tier (1.00x PPP).
- **Tax:** Stripe Tax handles state sales tax automatically across all 45 sales tax states + DC + PR. Need to register in states where economic nexus is hit. Some states tax SaaS (NY, TX, PA, WA, CT, MA, OH, AZ, CO local), some don't (CA, FL, IL, VA, GA, NC).
- **Invoice format:** No federal requirement. Include: legal entity name, address, EIN (on request), tax breakdown by jurisdiction.
- **Reverse charge / B2B:** N/A â€” US doesn't use reverse charge. Use resale/exemption certificates where applicable.
- **Fraud patterns:** Card testing from VPNs; BIN attacks; promo abuse via disposable emails; chargeback fraud from large-volume B2C use. Stripe Radar default + custom rules for $0 verification charges.
- **Refund processing:** Credit card refunds 5â€“10 business days per Reg E/Z. ACH reversals 1â€“2 days. Honor 30-day money-back per refund policy doc 05d.

## C. Compliance Frameworks

- **Compliance agent rules:** CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA, TDPSA, OCPA, MCDPA, DPDPA, TCPA, CAN-SPAM, FTC Section 5, COPPA (block under-13), state AI laws (CO AI Act, CA SB 942/AB 2013, UT, TX). SOC 2 Type II by Month 9 â€” auditor: Prescient Assurance, Schellman, or A-LIGN.
- **Data residency:** No requirement. US-East primary, US-West DR.
- **Cross-border transfers:** Inbound from EU/UK/CH via SCCs + supplementary measures or via DPF (EU-US Data Privacy Framework â€” self-certify via commerce.gov/DPF). FunelAI self-certifies DPF + UK Extension + Swiss-US DPF by Month 3.
- **Subject access:** 45 days under CCPA (one 45-day extension allowed). Verify identity. Free for first 2 requests per 12 months. Authorized agent mechanism required.
- **Breach notification:** Patchwork â€” CA 72 hours to AG if >500 residents affected; most states "without unreasonable delay." HHS 60 days under HIPAA if applicable. Notify Stripe/processor if payment data.
- **Industry overlay:** HIPAA-eligible architecture by Month 12 (separate tenant tier); SOC 2 Type II baseline; PCI DSS via Stripe SAQ-A.

## D. Content & Localization

- **Language:** EN-US at launch. ES-US (Spanish for US Hispanic market) by Month 6.
- **Cultural adaptation:** BBB accreditation, Trustpilot, G2 badges, "As seen in" press logos (TechCrunch, Forbes, Inc.), money-back guarantee badges, SOC 2 badge once earned. Testimonials with first name + last initial + city + photo is the trust-norm.
- **Diverging industries:** Insurance lead-gen (huge in US, regulated state-by-state); home services (HVAC, roofing â€” massive vertical); solar (post-IRA boom but state-specific incentives); legal â€” PI lead-gen distinct from general; education â€” for-profit colleges restricted (Gainful Employment rule).
- **Formatting:** MM/DD/YYYY; 12-hour clock; $1,234.56; imperial units default but allow metric.
- **Phone:** +1 NPA-NXX-XXXX. Validate via NANP. Block unallocated NPAs. Toll-free vs geographic â€” flag toll-free as lower trust for cold outreach.
- **Address:** Street, City, ST ZIP (5 or 9). Validate via USPS API.
- **Banned topics:** Per AUP doc 07a â€” no cannabis (federal), no firearms FFL, no payday lending, no adult, no MLM, no debt-relief without state license, no "make money online" unless verifiable.

## E. Support Operations

- **Time zone:** US team covers 6am PT â€“ 9pm ET (15-hr business window). Tier-1 chat 24/7 via follow-the-sun handoff to LATAM team (Month 4) and APAC team (Month 8).
- **Language:** EN, ES (Month 6).
- **Moderation:** Section 230 protections; remove illegal content (CSAM via NCMEC reporting, copyright via DMCA 512 takedown â€” register DMCA agent at copyright.gov).
- **Local holidays:** New Year, MLK Day, Presidents, Memorial, Juneteenth, July 4, Labor Day, Columbus/Indigenous Peoples, Veterans, Thanksgiving + day after, Christmas Eve + Day. SLA extends 1 business day on federal holidays.
- **Phone support:** +1 toll-free (855 or 888) â€” provision via Twilio.

## F. Hosting & Infrastructure

- **Cloudflare R2:** ENAM (Eastern North America).
- **Postgres:** AWS us-east-1 primary; us-west-2 DR.
- **CDN:** Cloudflare global; pop priority US/CA.
- **Email IPs:** Dedicated IPs via SendGrid/Postmark for transactional; SES warm pool for outbound campaign mail; segregate cold outreach to a separate sub-IP pool to protect transactional reputation.
- **Phone DIDs for RevTry:** Twilio US local DIDs by area code matched to lead area code; toll-free for compliance-heavy verticals.

## G. Marketing

- **Ad creative:** Native EN-US copy; humor permitted; aggressive claims allowed if substantiable per FTC.
- **Influencers:** Marketing Twitter/X creators â€” pursue: Codie Sanchez (operator audience), Sam Parr (My First Million), Greg Isenberg (Late Checkout), Pat Walls (Starter Story), Ben Tossell (no-code).
- **Communities:** Indie Hackers, r/SaaS, r/Entrepreneur, r/sales, GrowthHackers, MicroConf Connect Slack, On Deck.
- **PR targets:** TechCrunch (Connie Loizos AI), The Information, Axios Pro, Forbes (Alex Konrad), Inc., Fast Company.
- **Case studies:** 3 case studies needed before scale spend â€” target: HVAC contractor, B2B SaaS reseller, online course creator.
- **Affiliates:** Recruit through PartnerStack, FirstPromoter; target SaaS-focused affiliates (Ramp, Pipedrive, HubSpot resellers).

## H. Integration Status

- **Platforms:** All US ad platforms work â€” Google Ads, Meta, TikTok, LinkedIn, X, Reddit Ads, Pinterest. CRMs â€” HubSpot, Salesforce, Pipedrive, Close, Zoho, Copper. Calendars â€” Google, Outlook/M365, Apple iCloud. SMS â€” Twilio, MessageBird. Voice â€” Twilio, Vonage. Email â€” SendGrid, Mailgun, Postmark, AWS SES.
- **Restrictions:** None at country level.
- **Stripe:** Full support.
- **Calendar:** Google + M365 cover 95%+ of US business users.

## I. Launch Phasing

- **60-day pre-launch:** DPF self-certification submitted; Stripe Tax onboarding; state nexus analysis; counsel review of ToS/Privacy/AUP; TCPA call-flow audit; SendGrid + Twilio account setup with dedicated pools; SOC 2 Type I kickoff.
- **Launch week:** DNS cutover; status page live (statuspage.io); support inbox monitored; FCM/Slack on-call rotation; Stripe live mode; pilot 25 design partners.
- **30-day post:** Review first 30 days of complaints/refund requests; chargeback rate <0.5%; FTC/state AG keyword monitor (Mention.com); first SAR drill.
- **90-day stability:** SOC 2 Type I report; renew DPF; review state nexus thresholds; case studies published; expand to 1,000 customers.

## J. Owner

- **Owner:** US Country Lead (Founder/CEO holds interim).
- **Local partner:** N/A (home market).
- **Legal counsel:** Cooley LLP (primary), Klein Moynihan Turco (TCPA defense), Loeb & Loeb (advertising/IP).

---

# 2. United Kingdom

## A. Legal & Regulatory

- **Local counsel:** Bird & Bird LLP, Fieldfisher, Kemp Little (now Deloitte Legal), or Taylor Wessing for tech/AI; for ASA advertising disputes â€” Lewis Silkin.
- **ToS / Privacy Policy:** UK-specific privacy policy under UK GDPR + Data Protection Act 2018; reference ICO. Distinct from EU policy post-Brexit. Consumer Rights Act 2015 compliance for B2C tier.
- **AI disclosure:** No UK AI Act yet â€” pro-innovation, sector-led approach (ICO, CMA, Ofcom, FCA each issue guidance). ICO guidance on AI and data protection requires DPIA for high-risk processing. CMA AI Foundation Models report. Transparency obligation: tell users when interacting with AI. Watch Data (Use and Access) Act 2025 + the upcoming AI Bill (consultation closed 2025).
- **Telemarketing:** PECR (Privacy and Electronic Communications Regulations). Automated calls â€” prior consent required, hard stop. CTPS (Corporate Telephone Preference Service) + TPS for consumers â€” screen mandatory. ICO fines up to Â£17.5M.
- **Anti-spam:** PECR + UK GDPR. B2B: legitimate interest possible for individual employees at corporate entities, but soft opt-in to existing customers only. B2C: prior consent. Unsubscribe in every message.
- **Data protection:** UK GDPR + DPA 2018. ICO is regulator. Register with ICO and pay data protection fee (Â£40â€“Â£2,900 based on size).
- **Consumer rights:** Consumer Contracts Regulations 2013 â€” 14-day cooling-off for distance B2C contracts; SaaS digital content carve-out if consumer consents to immediate supply and acknowledges loss of cancellation right.
- **Sector-specific:** FCA for financial promotions (new s.21 FSMA approval regime for finproms by approved persons â€” applies to lead-gen for financial products); MHRA for medical device advertising; Solicitors Regulation Authority and Bar Standards Board for legal lead-gen; ASA CAP/BCAP codes for all advertising.
- **Local entity:** Not strictly required, but UK Ltd or branch advised by Month 6 for VAT/HMRC if revenue >Â£90K. UK Representative under Article 27 UK GDPR required if no UK establishment. Appoint via service like VeraSafe or EDPO UK.

## B. Payment Rails

- **Primary rail:** Stripe (GBP). PayPal secondary. Bacs Direct Debit via GoCardless for annual contracts.
- **Currency:** GBP. PPP tier: 0.95x US.
- **Tax:** VAT 20% standard. Stripe Tax handles. Register for UK VAT when taxable turnover >Â£90K (from April 2024). MOSS scheme N/A post-Brexit â€” register directly.
- **Invoice format:** VAT invoice must include VAT number, breakdown, supplier + customer name/address, invoice date, unique sequential number, description.
- **Reverse charge / B2B:** Reverse charge applies for B2B sales to UK VAT-registered customers if FunelAI is non-UK established â€” capture and validate VAT number via HMRC API.
- **Fraud patterns:** Authorized push payment (APP) fraud trending; Stripe Radar + 3DS2 mandatory under SCA.
- **Refund:** 14-day statutory; 5â€“10 business days for card. Honor via standard refund policy.

## C. Compliance Frameworks

- **Compliance agent rules:** UK GDPR, DPA 2018, PECR, Consumer Rights Act 2015, ASA CAP/BCAP, Online Safety Act 2023 (user-to-user services duties â€” applies if AUP-related content moderation), Equality Act 2010 for non-discrimination in AI outputs.
- **Data residency:** No strict requirement, but UK ICO prefers UK or adequacy-decision countries. Use UK or EU region.
- **Cross-border transfers:** UK adequacy decision for EEA; for US â€” UK Extension to EU-US DPF (self-certify with US partner if any) or UK IDTA / Addendum to SCCs.
- **Subject access:** 1 month standard; one 2-month extension if complex. Free; can charge for manifestly excessive requests.
- **Breach notification:** 72 hours to ICO if risk to rights; notify data subjects if high risk.
- **Industry overlay:** FCA Consumer Duty (Jul 2023) for financial product lead-gen.

## D. Content & Localization

- **Language:** EN-GB at launch (separate locale from EN-US â€” spelling, currency symbol, conventions).
- **Cultural adaptation:** Understatement preferred; avoid US-style hard sell; ICO registration badge; ISO 27001 / Cyber Essentials Plus; ASA-compliant claims; "Reg in England No." footer; payment logos.
- **Diverging industries:** Property (estate agents â€” distinct from US real estate model; OnTheMarket, Rightmove); tradesmen (Checkatrade, MyBuilder, Rated People); accountants (much higher SME density); private healthcare (Bupa, AXA PPP).
- **Formatting:** DD/MM/YYYY; 24-hour clock common; Â£1,234.56; metric.
- **Phone:** +44; validate UK numbering plan (e.g., 07xxx mobile, 020 London).
- **Address:** Line 1, Line 2, Town, County (optional), Postcode (validate via Royal Mail PAF / Loqate).
- **Banned topics:** No payday lending without FCA authorization; no CFD/crypto B2C without FCA approval; no gambling without UKGC license; tobacco/vaping per Tobacco Advertising Act.

## E. Support Operations

- **Time zone:** UK team or shared with EU 9amâ€“6pm GMT/BST.
- **Language:** EN.
- **Moderation:** Online Safety Act duties for user-generated content; report CSAM via IWF.
- **Local holidays:** New Year, Good Friday, Easter Monday, Early May BH, Spring BH, Summer BH (last Mon Aug), Christmas, Boxing Day. Scotland/NI variants.
- **Phone support:** 0800 freephone â€” provision via Twilio.

## F. Hosting & Infrastructure

- **R2:** WEUR.
- **Postgres:** AWS eu-west-2 (London).
- **CDN:** Cloudflare LHR/MAN edges.
- **Email IPs:** Dedicated EU-region SendGrid pool.
- **DIDs:** Twilio UK geographic (020, 0121, etc.) and 0800/0808.

## G. Marketing

- **Ad creative:** Native EN-GB; dry humor permitted; ASA substantiation file maintained.
- **Influencers:** Daniel Priestley, Chris Donnelly, Steven Bartlett (DOAC â€” premium tier), Eddie Shleyner (B2B copy), Amelia Sordell (LinkedIn personal branding).
- **Communities:** UK Tech News, SaaStock community, Startup Grind London, TechHub Slack, Founders Network UK.
- **PR:** TechCrunch EU (Mike Butcher), Sifted, UKTN, The Times Tech, FT Tech.
- **Case studies:** UK estate agent, UK B2B SaaS, UK trade/services franchise.
- **Affiliates:** Awin (UK-headquartered), Impact, PartnerStack.

## H. Integration Status

- **Platforms:** Google, Meta, TikTok, LinkedIn, X â€” all work. Reddit smaller. Snapchat per audience. ITV/Channel 4 ads via separate brokers (not Funnel-relevant at launch).
- **Stripe:** Full UK support.
- **Calendar:** Google + M365 dominant; ICloud minor.

## I. Launch Phasing

- **60-day:** ICO registration; UK Representative engaged; counsel review UK ToS/Privacy; PECR audit; VAT registration pre-emptively or threshold monitor.
- **Launch week:** EN-GB locale live; UK DIDs provisioned; UK support inbox; status page UK region.
- **30-day:** ICO data fee paid; first SAR drill UK; ASA scan of running creative; sample VAT invoice audit.
- **90-day:** Consider UK Ltd if >Â£90K trailing; ISO 27001 scoping decision; case studies live.

## J. Owner

- **Owner:** UK & Ireland Country Lead (hire Month 4, London-based).
- **Local partner:** VeraSafe (Article 27 rep), Cyber Essentials Plus assessor.
- **Legal counsel:** Bird & Bird (primary).

---

# 3. Canada

## A. Legal & Regulatory

- **Local counsel:** Osler, Hoskin & Harcourt LLP; McCarthy TÃ©trault; Borden Ladner Gervais (BLG); Fasken (Quebec specialty).
- **ToS / Privacy Policy:** Bilingual mandatory (EN + FR) â€” Quebec strictly enforces French via OQLF. Reference PIPEDA + Quebec Law 25 + Alberta PIPA + BC PIPA.
- **AI disclosure:** No federal AI law yet â€” AIDA (Artificial Intelligence and Data Act) under Bill C-27 stalled; voluntary code of practice for generative AI. Quebec Law 25 requires disclosure of automated decision-making and the right to obtain information about the decision. Disclose AI interaction up-front.
- **Telemarketing:** Unsolicited Telecommunications Rules (CRTC). National DNCL screening required. Express consent for ADADs (Automatic Dialing-Announcing Devices) â€” incl. AI voice. CRTC fines up to $15K/violation individual, $1.5M corporate.
- **Anti-spam:** CASL (Canada's Anti-Spam Legislation) â€” strict opt-in consent regime (express or implied within narrow categories). Unsubscribe must be functional for 60 days, processed within 10 days. CRTC enforces; penalties up to $10M.
- **Data protection:** PIPEDA (federal) + Quebec Law 25 (deemed substantially similar but stricter â€” privacy impact assessments mandatory, data residency considerations, breach notification, automated decision rights). Alberta PIPA & BC PIPA for private-sector intra-provincial.
- **Consumer rights:** Provincial consumer protection acts â€” Ontario CPA, Quebec Consumer Protection Act (strictest, French-only contracts unenforceable, no auto-renewal without opt-in confirmation), Alberta CPA, BC BPCPA.
- **Sector-specific:** OSFI for financial; Health Canada for medical; provincial law societies for legal lead-gen.
- **Local entity:** Not required for SaaS sales, but advisable Month 9. GST/HST registration required when revenue >CAD$30K (small supplier threshold). Quebec QST separate. PIPEDA breach reporting + Quebec privacy officer designation required.

## B. Payment Rails

- **Primary rail:** Stripe (CAD). PayPal secondary. Interac e-Transfer for annual contracts via integrations like Plooto/Rotessa.
- **Currency:** CAD. PPP tier: 0.85x US.
- **Tax:** GST 5% federal + provincial: HST in ON/NB/NL/NS/PEI 13â€“15%; QST 9.975% in Quebec; PST in BC/SK/MB. Stripe Tax handles. Quebec QST registration separate from GST. SaaS taxable in most provinces.
- **Invoice format:** Include GST/HST/QST registration number, breakdown by tax, bilingual in Quebec.
- **Reverse charge / B2B:** GST/HST self-assessment by registered businesses (ITC eligible).
- **Fraud patterns:** Standard NA patterns; lower fraud rate than US.
- **Refund:** Provincial varies; Quebec 10-day cooling-off for distance contracts; honor 30-day policy.

## C. Compliance Frameworks

- **Compliance agent rules:** PIPEDA, Quebec Law 25, Alberta PIPA, BC PIPA, CASL, CRTC Unsolicited Telecom Rules, provincial CPAs, Bill 96 (Quebec French Language Charter).
- **Data residency:** Quebec Law 25 â€” transfers outside Quebec require privacy impact assessment + comparable protection; effectively pushes hosting to CA-Central-1 (Montreal) for QC data. BC for public-sector data residency (not applicable to us at launch).
- **Cross-border transfers:** PIPEDA permits with comparable protection + accountability; Law 25 stricter â€” PIA required. Use SCCs-equivalent contractual protections.
- **Subject access:** 30 days standard.
- **Breach notification:** PIPEDA â€” "real risk of significant harm" trigger, notify OPC and individuals; Quebec â€” 72 hours functional standard.
- **Industry overlay:** Bilingual UI obligation for Quebec consumers.

## D. Content & Localization

- **Language:** EN-CA + FR-CA at launch (Bill 96 â€” businesses serving Quebec must offer French equivalent of equal quality). FR-CA distinct from FR-FR (Quebec terminology).
- **Cultural adaptation:** BBB Canada, less hype, trust badges in both languages, Quebec OQLF "francisation" certificate where applicable.
- **Diverging industries:** Mortgage brokers (provincial licensing; FSRA in Ontario, AMF in Quebec); cannabis (legal federally â€” but advertising tightly restricted under Cannabis Act); insurance (provincial); resource/mining lead-gen niche.
- **Formatting:** YYYY-MM-DD official (ISO); also DD/MM in QC; CAD$1,234.56; metric.
- **Phone:** +1 NANP; CRTC area codes.
- **Address:** Civic # + street, City, Province, Postal Code (A1A 1A1). Validate via Canada Post AddressComplete.
- **Banned topics:** Cannabis advertising heavily restricted (no lifestyle, no promotion to minors); same exclusions as US re: AUP.

## E. Support Operations

- **Time zone:** Pacific to Newfoundland â€” 4.5 hour spread. Share with US team during overlap.
- **Language:** EN, FR-CA.
- **Moderation:** Criminal Code obligations for hate speech, CSAM.
- **Holidays:** New Year, Good Friday, Victoria Day, Canada Day (Jul 1), Civic (Aug), Labour Day, Thanksgiving (2nd Mon Oct), Remembrance Day (varies), Christmas, Boxing Day. Quebec: St-Jean-Baptiste (Jun 24).
- **Phone support:** Toll-free (8YY shared with US).

## F. Hosting & Infrastructure

- **R2:** ENAM.
- **Postgres:** AWS ca-central-1 (Montreal) primary for Quebec users; US-East shared region acceptable for ROC with consent.
- **CDN:** Cloudflare YYZ/YUL.
- **Email:** SendGrid/SES NA pool; CASL flagging in template builder.
- **DIDs:** Twilio CA local DIDs by area code.

## G. Marketing

- **Ad creative:** Native EN-CA + FR-CA (NOT translated FR-FR â€” Quebec audience rejects France French).
- **Influencers:** Dan Martell (SaaS Academy â€” Canadian), Anthony Vicino (creator), Pat Flynn (CA roots), Quebec â€” Hubert Palan, Mathieu LaferriÃ¨re.
- **Communities:** Tech Toronto, BetaKit, Startup Canada, AQT (Quebec tech), Montreal NewTech.
- **PR:** BetaKit, The Logic, Globe & Mail Report on Business, La Presse (FR), Les Affaires (FR).
- **Case studies:** Toronto SaaS, Quebec services business (FR), Vancouver e-comm.
- **Affiliates:** PartnerStack (Canadian company â€” strong fit), Impact.

## H. Integration Status

- **Platforms:** Google, Meta, TikTok, LinkedIn â€” all work. Snap, Reddit minor.
- **Stripe:** Full CA support.
- **Calendar:** Google + M365.

## I. Launch Phasing

- **60-day:** Bilingual ToS/Privacy reviewed by Quebec counsel; CASL audit of email flows; GST/HST registration; Quebec privacy officer designated.
- **Launch week:** FR-CA locale live; FR-CA support trained; ca-central-1 primary for QC.
- **30-day:** Quebec Law 25 PIA filed; QST registration if QC revenue.
- **90-day:** Bill 96 compliance audit; case studies bilingual.

## J. Owner

- **Owner:** Canada Country Lead (Toronto or Montreal, hire Month 5).
- **Local partner:** Quebec privacy specialist via Fasken.
- **Legal counsel:** Osler (primary), Fasken (Quebec).

---

# 4. Australia

## A. Legal & Regulatory

- **Local counsel:** Gilbert + Tobin, Allens, Herbert Smith Freehills, MinterEllison; tech/AI specialty: Maddocks.
- **ToS / Privacy Policy:** Australian Privacy Principles (APPs) under Privacy Act 1988. Spam Act 2003 disclosures.
- **AI disclosure:** No AI Act â€” voluntary AI Ethics Principles. Mandatory guardrails for high-risk AI proposed (Sept 2024 paper). Disclose AI interaction. Watch Privacy Act reform 2025â€“26 (automated decisions disclosure rules in tier-1 reforms).
- **Telemarketing:** Do Not Call Register Act 2006 â€” screen DNCR; consent required for marketing calls. ACMA enforces. Time-of-day restrictions.
- **Anti-spam:** Spam Act 2003 â€” consent (express or inferred) required, identification, unsubscribe within 5 business days. Fines up to AU$2.2M/day.
- **Data protection:** Privacy Act 1988 + Notifiable Data Breaches scheme. OAIC regulator. Reforms expanded scope (small business exemption being repealed).
- **Consumer rights:** Australian Consumer Law (ACL) â€” consumer guarantees cannot be excluded; B2B if value <AU$100K or ordinary use also covered. 14-day cooling-off for unsolicited consumer agreements (not most SaaS).
- **Sector-specific:** ASIC for financial product lead-gen (Design and Distribution Obligations); TGA for medical; state legal profession acts; ACMA for telco/comms.
- **Local entity:** Not required for SaaS export, but Australian Business Number (ABN) recommended for GST. GST registration when GST turnover >AU$75K. Non-resident GST applies to digital products to Australian consumers from $0.

## B. Payment Rails

- **Primary rail:** Stripe (AUD). PayPal secondary. PayTo (NPP â€” New Payments Platform) by Month 9 for direct debit.
- **Currency:** AUD. PPP tier: 0.95x US.
- **Tax:** GST 10%. B2C requires Australian GST registration regardless of threshold (digital products rule). B2B reverse charge if customer ABN provided + GST-registered. Stripe Tax handles.
- **Invoice format:** Tax Invoice with ABN, GST inclusive total + GST breakdown, date, supplier, customer (>AU$1,000).
- **Reverse charge / B2B:** Yes â€” collect and verify ABN via ABR API.
- **Fraud patterns:** Lower fraud than US; some crypto-adjacent fraud rings.
- **Refund:** ACL remedies â€” repair/replace/refund for major failures; 30-day policy honored.

## C. Compliance Frameworks

- **Compliance agent rules:** Privacy Act + APPs, Spam Act 2003, DNC Register Act, ACL, ASIC DDO for financial verticals.
- **Data residency:** No strict requirement, but cross-border disclosure has accountability rules â€” APP 8.
- **Cross-border transfers:** APP 8 â€” reasonable steps to ensure overseas recipient handles per APPs, or accountability remains.
- **Subject access:** 30 days; no fee for reasonable request.
- **Breach notification:** Notifiable Data Breaches â€” "eligible data breach" with likely serious harm; notify OAIC and affected individuals "as soon as practicable."
- **Industry overlay:** Watch Privacy Act tier-1 reforms (statutory tort for serious privacy invasions).

## D. Content & Localization

- **Language:** EN-AU at launch.
- **Cultural adaptation:** Avoid Americanisms; informal tone OK; honest claims (ACCC enforces misleading conduct); Aus Trustmark; case studies with local geography.
- **Diverging industries:** Trades (HIA-licensed builders, hipages platform); mortgage brokers (different from US â€” broker-dominant market); migration agents (MARA-registered â€” restricted advertising).
- **Formatting:** DD/MM/YYYY; 24-hour acceptable; AU$1,234.56; metric.
- **Phone:** +61; mobile 04xx; geographic 02/03/07/08.
- **Address:** Line, Suburb, State (NSW/VIC/QLD/etc.), Postcode (4 digits). Validate via AusPost / Loqate.
- **Banned topics:** Gambling â€” tightly regulated, federal + state licenses required; therapeutic goods â€” TGA restrictions; tobacco/vapes â€” strict.

## E. Support Operations

- **Time zone:** AEST/AEDT â€” APAC team or shared with Asia team 9amâ€“6pm Sydney.
- **Language:** EN.
- **Moderation:** eSafety Commissioner regulations; report CSAM.
- **Holidays:** New Year, Australia Day, Good Friday, Easter Monday, Anzac Day (Apr 25), King's Birthday (varies by state), Labour Day (varies), Christmas, Boxing Day. State-specific extras.
- **Phone support:** 1300/1800 numbers via Twilio.

## F. Hosting & Infrastructure

- **R2:** APAC (Sydney POP available).
- **Postgres:** AWS ap-southeast-2 (Sydney).
- **CDN:** Cloudflare SYD/MEL.
- **Email:** SendGrid APAC pool.
- **DIDs:** Twilio AU local + 1300/1800.

## G. Marketing

- **Ad creative:** EN-AU native, irreverent tone works.
- **Influencers:** Tim Reid (Small Business Big Marketing), James Schramko (SuperFastBusiness), Mark Bouris (financial), Janine Allis, Steve Sammartino.
- **Communities:** Startmate, Fishburners, SaaStralia Slack, Australian Tech Council.
- **PR:** SmartCompany, AFR Tech, Startup Daily, ITNews, The Australian Business.
- **Case studies:** Sydney B2B SaaS, Melbourne agency, Perth trades.
- **Affiliates:** Commission Factory (AU-based), Impact, PartnerStack.

## H. Integration Status

- **Platforms:** All majors work. LinkedIn strong B2B. Snap weaker.
- **Stripe:** Full AU support.
- **Calendar:** Google + M365.

## I. Launch Phasing

- **60-day:** APP compliance review; Spam Act audit; ABN + GST registration; DNCR access.
- **Launch week:** AU locale; Sydney POP; AU DIDs; AEST support.
- **30-day:** NDB scheme drill; ACMA cold-call audit.
- **90-day:** ACCC consumer guarantee audit; consider Pty Ltd if hiring.

## J. Owner

- **Owner:** ANZ Country Lead (Sydney, hire Month 6).
- **Local partner:** none required at launch.
- **Legal counsel:** Gilbert + Tobin (primary).

---

# 5. Mexico

## A. Legal & Regulatory

- **Local counsel:** Creel, GarcÃ­a-CuÃ©llar, Aiza y EnrÃ­quez; Galicia Abogados; Mijares, Angoitia, CortÃ©s y Fuentes; Baker McKenzie Mexico; Von Wobeser y Sierra.
- **ToS / Privacy Policy:** Spanish-language Aviso de Privacidad (mandatory format per LFPDPPP) â€” simplified, short, and integral versions; point of collection notice. Mexican consumer protection (PROFECO) disclosures.
- **AI disclosure:** No AI law; Federal Telecom and Broadcasting Law and consumer protection apply. Disclose AI interaction up-front. Watch federal AI initiatives 2026.
- **Telemarketing:** REPEP (Registro PÃºblico para Evitar Publicidad) operated by PROFECO â€” screen mandatory; time restrictions; ID disclosure.
- **Anti-spam:** No CAN-SPAM equivalent specifically, but LFPDPPP requires consent for marketing communications and unsubscribe must be honored.
- **Data protection:** LFPDPPP (Ley Federal de ProtecciÃ³n de Datos Personales en PosesiÃ³n de los Particulares) + Regulation. INAI regulator (now restructured following reform â€” successor body has same functions). Aviso de Privacidad strict format. ARCO rights (Access, Rectification, Cancellation, Opposition + Revocation of consent).
- **Consumer rights:** Federal Consumer Protection Law (LFPC) â€” PROFECO. Adhesion contract registration potentially required for B2C; B2B SaaS generally exempt but verify by counsel.
- **Sector-specific:** CNBV for fintech (Ley Fintech 2018 â€” registration if regulated activity); COFEPRIS for medical; financial advertising rules.
- **Local entity:** Not required for cross-border SaaS, but RFC (tax ID) registration may be required for VAT collection on digital services to Mexican residents (IVA digital services rules â€” non-resident providers must register since 2020).

## B. Payment Rails

- **Primary rail:** Stripe (MXN) + OXXO (cash voucher network â€” Stripe supports), SPEI (bank transfer). PayPal secondary. Local cards via Stripe.
- **Currency:** MXN. PPP tier: 0.45x US.
- **Tax:** IVA 16% federal. Non-resident digital service providers must register with SAT and collect IVA on B2C; 16% withholding for unregistered. CFDI invoice required for tax-deductibility for Mexican business customers.
- **Invoice format:** CFDI 4.0 (Comprobante Fiscal Digital por Internet) via SAT-authorized PAC (Proveedor Autorizado de CertificaciÃ³n). Requires customer RFC, fiscal regime, postal code. FunelAI integrates with a PAC like Facturama, KonfÃ­o FacturaciÃ³n, or Edicom by Month 3.
- **Reverse charge / B2B:** N/A â€” IVA standard.
- **Fraud patterns:** Stolen-card BIN attacks; OXXO voucher abandon rates (treat as pending, not committed).
- **Refund:** PROFECO 5 business days for digital reversals; honor 30-day policy.

## C. Compliance Frameworks

- **Compliance agent rules:** LFPDPPP, LFPC, Ley Fintech (if applicable), CFDI compliance, SAT IVA rules.
- **Data residency:** No strict requirement.
- **Cross-border transfers:** Notice + consent under LFPDPPP; recipient must observe Aviso de Privacidad.
- **Subject access:** ARCO requests â€” 20 business days response.
- **Breach notification:** "Immediately" notify data owners when breach affects rights; no fixed regulator-notification clock but must inform affected individuals.
- **Industry overlay:** None at launch.

## D. Content & Localization

- **Language:** ES-MX at launch (NOT ES-ES â€” Mexican Spanish is distinct: "ustedes" not "vosotros," local idioms, lower formality).
- **Cultural adaptation:** Trust badges include PROFECO; testimonials with first name + state; payment logos very visible; family-business friendly tone.
- **Diverging industries:** Auto dealerships (large second-hand market); real estate (broker-driven); educaciÃ³n continua; restaurantes/franquicias; servicios tÃ©cnicos.
- **Formatting:** DD/MM/YYYY; 24-hour common; MX$1,234.56 or $1,234.56 MXN; metric.
- **Phone:** +52 then 10-digit; validate Telcom assignations.
- **Address:** Calle + #, Colonia, Municipio/AlcaldÃ­a, Estado, CP (5 digits).
- **Banned topics:** Cannabis pending federal regs; gambling â€” SEGOB license; firearms â€” federal restriction.

## E. Support Operations

- **Time zone:** CST Mexico (UTC-6). LATAM team covers MX + Brazil + Spanish-speaking SA 8amâ€“8pm.
- **Language:** ES-MX, EN backup.
- **Moderation:** Criminal Code obligations.
- **Holidays:** AÃ±o Nuevo (Jan 1), DÃ­a de la ConstituciÃ³n (1st Mon Feb), Natalicio de JuÃ¡rez (3rd Mon Mar), Jueves/Viernes Santo, DÃ­a del Trabajo (May 1), DÃ­a de la Independencia (Sep 16), DÃ­a de la RevoluciÃ³n (3rd Mon Nov), Navidad. Banking holidays add DÃ­a de los Muertos influence.
- **Phone support:** Mexican toll-free (01 800) via Twilio.

## F. Hosting & Infrastructure

- **R2:** WNAM.
- **Postgres:** AWS us-east-1 acceptable (no residency requirement); consider us-west-2 for lower LATAM latency or AWS Mexico region as it matures.
- **CDN:** Cloudflare QRO (QuerÃ©taro) and MEX (Mexico City) edges.
- **Email:** SendGrid NA with reputation watch (LATAM bounce rates higher).
- **DIDs:** Twilio MX local + 01-800 toll-free.

## G. Marketing

- **Ad creative:** Native ES-MX, warm/family-oriented, trust-led.
- **Influencers:** Carlos Master MuÃ±oz (negocios), Brian Tracy MX licensees, Daniel Habif (mindset/business mix), Bonilla Yajaira, Vilma NÃºÃ±ez (digital marketing, Spain-based but huge MX audience).
- **Communities:** Mexican Founders, Startup MÃ©xico, 500 LatAm alumni, Endeavor MÃ©xico.
- **PR:** ExpansiÃ³n, El Economista, Forbes MÃ©xico, Whitepaper.mx, Entrepreneur en EspaÃ±ol.
- **Case studies:** CDMX agency, MTY industrial services, GDL e-commerce.
- **Affiliates:** Hotmart (LATAM affiliate dominant), Awin LATAM, Impact.

## H. Integration Status

- **Platforms:** Google, Meta, TikTok dominant; LinkedIn growing; WhatsApp Business essential (Meta integration â€” bake into RevTry).
- **Stripe:** Full MX support incl OXXO and SPEI.
- **Calendar:** Google dominant; M365 mid-market.

## I. Launch Phasing

- **60-day:** SAT registration as foreign digital service provider; CFDI PAC integration; Aviso de Privacidad in 3 versions; REPEP access.
- **Launch week:** ES-MX UI; CFDI generation live; OXXO + SPEI active; PROFECO points of contact.
- **30-day:** IVA filing readiness; first ARCO request drill.
- **90-day:** WhatsApp Business API verified; revisit RFC requirements.

## J. Owner

- **Owner:** LATAM Country Lead â€” Mexico focus (CDMX or remote, hire Month 5).
- **Local partner:** Facturama (CFDI PAC).
- **Legal counsel:** Creel GarcÃ­a-CuÃ©llar (primary).

---

# 6. Brazil

## A. Legal & Regulatory

- **Local counsel:** Pinheiro Neto Advogados; Mattos Filho; Demarest; TozziniFreire; Veirano; for AI/data specialty â€” Opice Blum.
- **ToS / Privacy Policy:** Portuguese (PT-BR) mandatory. LGPD-aligned. CDC (CÃ³digo de Defesa do Consumidor) disclosures.
- **AI disclosure:** PL 2338/2023 AI bill advancing (Senate passed Dec 2024) â€” risk-based framework similar to EU AI Act. ANPD (Autoridade Nacional de ProteÃ§Ã£o de Dados) issued AI guidance. Disclose AI interactions; impact assessment for high-risk.
- **Telemarketing:** NÃ£o Me Perturbe registry â€” screen mandatory; ANATEL rules. State-level laws (e.g., SP) ban robocalls without consent. Caller ID required.
- **Anti-spam:** LGPD consent + CDC. CAPEM (ComitÃª Antispam) self-regulation. SPF/DKIM/DMARC must be in place or providers will reject.
- **Data protection:** LGPD (Lei Geral de ProteÃ§Ã£o de Dados). ANPD regulator. DPO (Encarregado) appointment required. Strong ANPD enforcement post-2023.
- **Consumer rights:** CDC very strong â€” 7-day right of withdrawal for distance contracts (Art 49) â€” applies to SaaS B2C. PROCON state enforcement. Class actions easy.
- **Sector-specific:** BACEN for payment/fintech; ANVISA for medical; OAB (lawyer ad rules â€” restrictive); CVM for investment products.
- **Local entity:** Not required for SaaS export, but practical for tax â€” ISS (municipal service tax) collection complex without Brazilian entity. CNPJ helpful. Consider Marketplace model or use Stripe BR (which acts via local entity).

## B. Payment Rails

- **Primary rail:** Stripe BR (BRL) â€” installments (parcelado), Boleto BancÃ¡rio, Pix (instant). Pix critical â€” >50% of digital payments. PayPal secondary.
- **Currency:** BRL. PPP tier: 0.40x US.
- **Tax:** Federal + state + municipal mess. SaaS classified as software service (ISS municipal 2â€“5%) typically. Recent tax reform (EC 132/2023) introduces IBS/CBS dual-VAT â€” transition 2026â€“2033. PIS/COFINS for residents. For non-resident: increased withholdings.
- **Invoice format:** NFS-e (Nota Fiscal de ServiÃ§o eletrÃ´nica) for services â€” municipal format, varies by city. Integrate via providers like NFE.io, Migrate, Omie, or eNotas. Without local entity, customer self-withholds or uses purchase from abroad classification.
- **Reverse charge / B2B:** N/A in same form; withholdings (IRRF, CIDE, ISS) on cross-border payments may apply 15â€“25%.
- **Fraud patterns:** High chargeback risk; CPF validation essential; installment fraud common â€” limit parcelado on new accounts.
- **Refund:** Art 49 CDC â€” 7 days no-questions for distance B2C; honor immediately.

## C. Compliance Frameworks

- **Compliance agent rules:** LGPD, CDC, Marco Civil da Internet, ANPD resolutions, upcoming PL 2338 AI law.
- **Data residency:** No strict mandate, but ANPD encourages local processing; some regulated sectors require Brazilian residency.
- **Cross-border transfers:** LGPD Article 33 â€” adequacy decisions (none yet by ANPD), SCCs/BCRs, specific consent. ANPD published standard contractual clauses (2023).
- **Subject access:** 15 days response for data subject requests; free.
- **Breach notification:** "Reasonable time" â€” ANPD considers 2 business days. Notify ANPD + data subjects.
- **Industry overlay:** None at launch.

## D. Content & Localization

- **Language:** PT-BR at launch (distinct from PT-PT â€” vocabulary and tone differ).
- **Cultural adaptation:** Trust signals â€” Reclame Aqui rating (huge in BR); "Empresa Verificada"; SSL badges visible; testimonials with photo + first name + state.
- **Diverging industries:** Infoprodutos (digital courses massive â€” Hotmart ecosystem); coaches; corretores de imÃ³veis; advogados (subject to OAB ad rules); MEI/PJ services boom.
- **Formatting:** DD/MM/YYYY; 24-hour; R$ 1.234,56 (period thousands, comma decimal); metric.
- **Phone:** +55 then 2-digit DDD + 8 or 9 digits; validate ANATEL.
- **Address:** Logradouro + nÃºmero, Bairro, Cidade, UF, CEP (XXXXX-XXX). Validate via ViaCEP.
- **Banned topics:** Gambling (federal â€” sports betting now regulated under Bets law 2023, but other gambling restricted); medical claims; OAB lawyer advertising heavily restricted.

## E. Support Operations

- **Time zone:** BRT (UTC-3). LATAM team 8amâ€“8pm.
- **Language:** PT-BR primary, ES + EN backup.
- **Moderation:** Marco Civil da Internet â€” judicial takedown standard; specific obligations for CSAM, hate speech.
- **Holidays:** Ano Novo, Carnaval (Mon+Tue before Ash Wed â€” effectively shutdown Friâ€“Wed), Sexta-feira Santa, Tiradentes (Apr 21), Dia do Trabalho (May 1), Corpus Christi (movable), IndependÃªncia (Sep 7), Nossa Senhora Aparecida (Oct 12), Finados (Nov 2), ProclamaÃ§Ã£o da RepÃºblica (Nov 15), ConsciÃªncia Negra (Nov 20), Natal. Municipal holidays add â€” SÃ£o Paulo Jan 25, Rio Apr 23.
- **Phone support:** 0800 toll-free via Twilio.

## F. Hosting & Infrastructure

- **R2:** WNAM (closest available); push for SA region as Cloudflare adds.
- **Postgres:** AWS sa-east-1 (SÃ£o Paulo).
- **CDN:** Cloudflare GRU/GIG/FOR edges.
- **Email:** SendGrid NA pool with SA reputation; or local provider like Allinmail for high-volume PT-BR.
- **DIDs:** Twilio BR DIDs require special verification (CPF/CNPJ + address proof) â€” start at Month 2.

## G. Marketing

- **Ad creative:** Native PT-BR; warm/aspirational; show transformation; CDC-compliant claims.
- **Influencers:** Bruno Perini (negÃ³cios/investimentos), Erico Rocha (infoprodutos formula), Conrado Adolpho, Camila Porto (digital marketing), Caio Carneiro.
- **Communities:** Hotmart Tribo, RD Station community, Endeavor Brasil, Distrito, Cubo ItaÃº.
- **PR:** Exame, Pequenas Empresas Grandes NegÃ³cios, NeoFeed, Brazil Journal, StartSe.
- **Case studies:** SP infoprodutor, RJ agÃªncia, MG indÃºstria/PME, Curitiba SaaS.
- **Affiliates:** Hotmart (dominant BR platform â€” integration valuable), Eduzz, Monetizze.

## H. Integration Status

- **Platforms:** Meta, Google, TikTok dominant; WhatsApp Business absolutely essential (60%+ of business comms); Kwai (TikTok competitor). LinkedIn growing professional.
- **Stripe:** Full BR support via Stripe Brazil entity.
- **Calendar:** Google dominant.

## I. Launch Phasing

- **60-day:** LGPD DPIA; NFE.io / eNotas integration; counsel review PT-BR ToS; Encarregado (DPO) designated; Reclame Aqui account.
- **Launch week:** PT-BR UI; Pix + Boleto + parcelado live; NFS-e issuance; CDC right-of-withdrawal flow.
- **30-day:** First ANPD/PROCON inquiry handling drill; chargeback rate <1%.
- **90-day:** PL 2338 readiness review; case studies live; consider Brazilian LLC (Ltda) if scaling.

## J. Owner

- **Owner:** Brazil Country Lead (SÃ£o Paulo, hire Month 3 â€” PT-BR critical).
- **Local partner:** Opice Blum (LGPD specialist), NFE.io (fiscal docs).
- **Legal counsel:** Pinheiro Neto (primary).

---

# 7. Germany

## A. Legal & Regulatory

- **Local counsel:** Hengeler Mueller; Noerr; Gleiss Lutz; Hogan Lovells Munich; Taylor Wessing Germany; for data â€” SKW Schwarz, Bird & Bird DE.
- **ToS / Privacy Policy:** German (DE) mandatory for German consumers. AGB (Allgemeine GeschÃ¤ftsbedingungen) strict â€” BGB Â§Â§ 305â€“310 limits enforceability. Impressum legally required (TMG Â§5 / DDG Â§5) â€” name, address, contact, register info, VAT ID â€” on every site.
- **AI disclosure:** EU AI Act applies â€” phased dates from Feb 2025 (prohibited practices, AI literacy) through Aug 2026 (GPAI) and Aug 2027 (high-risk). Transparency obligations: tell users they're interacting with AI; mark AI-generated content (audio/image/video/text). FunelAI is a "limited risk" AI system under most use; flag any high-risk (e.g., scoring in employment/credit) â€” those would require conformity assessment.
- **Telemarketing:** UWG (Gesetz gegen den unlauteren Wettbewerb) Â§7 â€” prior express consent for any cold call to consumers; B2B requires "presumed consent" (sachlicher Bezug + interest). Fines up to â‚¬300K (Bundesnetzagentur). AI voice â€” strict consent.
- **Anti-spam:** UWG Â§7(2) â€” express consent for email marketing (double opt-in industry standard); B2B same standard. CCPA-style "soft opt-in" narrow.
- **Data protection:** GDPR + BDSG (Bundesdatenschutzgesetz). Federal + 16 state DPAs (BayLDA, BfDI etc.). DPO required (BDSG Â§38) when â‰¥20 employees regularly process personal data, or processing requires DPIA, or core activities = monitoring/large-scale special categories.
- **Consumer rights:** BGB Â§312g â€” 14-day right of withdrawal for distance contracts; digital content carve-out if customer explicitly consents to immediate performance and waives withdrawal right (acknowledgment must be clear and demonstrable). Verbraucherzentrale active.
- **Sector-specific:** BaFin for financial; BfArM for medical devices; UWG for advertising; competitor cease-and-desist (Abmahnung) culture â€” small UWG violations attract attorney letters.
- **Local entity:** Not required for SaaS export, but GDPR Article 27 EU Representative required if no EU establishment (engage VeraSafe / EDPO / Prighter). VAT-OSS via Ireland or another EU member possible â€” see Section B.

## B. Payment Rails

- **Primary rail:** Stripe (EUR) â€” cards, SEPA Direct Debit, Sofort, Giropay (deprecating), Klarna, PayPal. SEPA critical for B2B.
- **Currency:** EUR. PPP tier: 0.90x US.
- **Tax:** VAT 19% (Mehrwertsteuer). Register for OSS (One-Stop-Shop) in any EU member to file pan-EU B2C VAT. Stripe Tax handles.
- **Invoice format:** Strict requirements (UStG Â§14) â€” full address, USt-IdNr (VAT ID), invoice date, sequential number, quantity/description, net + tax + gross, payment terms. E-invoicing mandatory for B2B by 2028 (X-Rechnung / ZUGFeRD format).
- **Reverse charge / B2B:** Yes â€” collect customer VAT ID, validate via VIES, apply reverse charge for EU B2B outside DE.
- **Fraud patterns:** Lower fraud than US; SEPA mandate verification critical (chargeback risk on Direct Debit).
- **Refund:** 14-day right of withdrawal; refund within 14 days of cancellation.

## C. Compliance Frameworks

- **Compliance agent rules:** GDPR + BDSG, EU AI Act, ePrivacy/TTDSG (cookie consent), UWG, BGB consumer law, TMG/DDG (Impressum), DSA (Digital Services Act) â€” limited applicability unless intermediary, DGA, NIS2 (depending on classification).
- **Data residency:** No strict GDPR residency mandate, but BfDI guidance prefers EU/EEA. German public sector / health sector demands DE residency â€” out of scope for Year 1.
- **Cross-border transfers:** EU-US DPF (self-cert with US partner if applicable) or SCCs + supplementary measures; TIA (Transfer Impact Assessment) required post-Schrems II.
- **Subject access:** 1 month standard; extension 2 months if complex.
- **Breach notification:** 72 hours to competent supervisory authority (lead authority via one-stop-shop).
- **Industry overlay:** Healthcare = Â§203 StGB criminal confidentiality (treat healthcare customers as separate tenant tier with explicit BSI C5 / ISO 27001 by Month 18).

## D. Content & Localization

- **Language:** DE at launch.
- **Cultural adaptation:** Trust badges â€” TÃœV, Trusted Shops, eKomi, German hosting badge ("Made in Germany," "Server in Deutschland"); Impressum visible; data protection assurance prominent; testimonials with full disclosure; no over-claims (Abmahnung risk).
- **Diverging industries:** Handwerker (skilled trades â€” Meisterpflicht; Handwerksrolle registration); Steuerberater (tax advisors â€” strict advertising rules under StBerG); Heilpraktiker; KMU (Mittelstand) focus; insurance brokers Â§ 34d GewO.
- **Formatting:** DD.MM.YYYY; 24-hour; 1.234,56 â‚¬; metric.
- **Phone:** +49; geographic + 0151/0160/0170 mobile prefixes.
- **Address:** StraÃŸe + Hausnummer, PLZ Ort, Bundesland (optional).
- **Banned topics:** Gambling without state license; medical claims under HWG (Heilmittelwerbegesetz); tobacco/alcohol ad restrictions; political ads strict.

## E. Support Operations

- **Time zone:** CET/CEST. EU team 9amâ€“6pm.
- **Language:** DE, EN.
- **Moderation:** NetzDG superseded by DSA + national; report illegal content per BKA channels.
- **Holidays:** Neujahr, Karfreitag, Ostermontag, Tag der Arbeit (May 1), Christi Himmelfahrt, Pfingstmontag, Tag der Deutschen Einheit (Oct 3), 1. Weihnachtstag, 2. Weihnachtstag. State variants: Heilige Drei KÃ¶nige (BW/BY/ST), Fronleichnam, MariÃ¤ Himmelfahrt, Reformationstag, Allerheiligen, BuÃŸ- und Bettag (SN).
- **Phone support:** 0800 free or geographic via Twilio.

## F. Hosting & Infrastructure

- **R2:** WEUR.
- **Postgres:** AWS eu-central-1 (Frankfurt).
- **CDN:** Cloudflare FRA/MUC/DUS.
- **Email:** SendGrid EU pool (Frankfurt); strict double opt-in flows.
- **DIDs:** Twilio DE local (require local address verification â€” start 4 weeks pre-launch).

## G. Marketing

- **Ad creative:** Native DE; trust-led, conservative; factual, with substantiation. Long-form preferred over flash.
- **Influencers:** Frank Thelen (tech), Verena Pausder, Lea-Sophie Cramer, Tijen Onaran, Marc-Sven Kopka (B2B SaaS), Stefan Hopf, Christian Bischoff.
- **Communities:** OMR (Online Marketing Rockstars), Bits & Pretzels alumni, Startup-Verband, German Tech Entrepreneurs.
- **PR:** Handelsblatt, Wirtschaftswoche, GrÃ¼nderszene, t3n, OMR Magazin, Manager Magazin.
- **Case studies:** Bayern Mittelstand, Hamburg agency, Berlin SaaS.
- **Affiliates:** Awin (DE-headquartered), digidip, financeAds for fin verticals.

## H. Integration Status

- **Platforms:** Google, Meta, LinkedIn (strong DACH B2B), Xing (DACH-native professional â€” integrate if B2B push). TikTok growing. WhatsApp Business big.
- **Stripe:** Full DE support; SEPA + Sofort + Klarna critical.
- **Calendar:** M365 dominant DACH B2B; Google secondary.

## I. Launch Phasing

- **60-day:** EU Representative engaged; counsel review DE AGB + DatenschutzerklÃ¤rung + Impressum; DPO appointed; cookie consent (TTDSG) audit; AI Act gap analysis; VAT-OSS registration.
- **Launch week:** DE locale; Impressum live; SEPA + Klarna + PayPal active; EU AI Act transparency banners.
- **30-day:** Abmahnung-risk content scan; first BfDI/state DPA inquiry drill; competitor monitor.
- **90-day:** EU AI Act roadmap review; Trusted Shops certification; case studies; ISO 27001 scoping.

## J. Owner

- **Owner:** DACH Country Lead (Berlin or Munich, hire Month 4).
- **Local partner:** Prighter / VeraSafe (Art 27 rep); Trusted Shops; PAC for EU e-invoicing.
- **Legal counsel:** Hengeler Mueller or Taylor Wessing DE.

---

# 8. France

## A. Legal & Regulatory

- **Local counsel:** Gide Loyrette Nouel; Bredin Prat; Cleary Gottlieb Paris; Hogan Lovells Paris; for data â€” De Gaulle Fleurance, August Debouzy.
- **ToS / Privacy Policy:** French (FR) required for consumer-facing â€” Loi Toubon mandates French language. CGV (Conditions GÃ©nÃ©rales de Vente) for B2C + CGU.
- **AI disclosure:** EU AI Act + French CNIL guidance on AI. Strong CNIL enforcement on AI projects â€” sandbox program for pilots. Transparency obligations same as EU. France NumÃ©rique 2030 plan.
- **Telemarketing:** Loi Naegelen (loi du 24 juillet 2020) + Bloctel registry â€” strict opt-out registry, mandatory screening. Time windows: 10amâ€“1pm and 2pmâ€“8pm weekdays only; banned weekends/holidays (since 1 March 2023). Fines up to â‚¬375K/violation by DGCCRF.
- **Anti-spam:** LCEN (Loi pour la Confiance dans l'Ã‰conomie NumÃ©rique) â€” opt-in for B2C email/SMS; B2B soft opt-in possible for professional address with topical relevance. Unsubscribe mandatory.
- **Data protection:** GDPR + Loi Informatique et LibertÃ©s (since 1978, updated). CNIL regulator â€” strong enforcement; large fines (Google, Meta, Amazon).
- **Consumer rights:** Code de la consommation â€” 14-day right of withdrawal for distance B2C; digital content can waive with explicit consent + acknowledgment. DGCCRF enforces.
- **Sector-specific:** ACPR for financial; ANSM for medical; advocate advertising restricted (Conseil National des Barreaux); ARJEL/ANJ for gambling.
- **Local entity:** Not required for SaaS export; EU Representative under Article 27 if no EU establishment. VAT-OSS option. SIRET registration not needed for export.

## B. Payment Rails

- **Primary rail:** Stripe (EUR) â€” Cartes Bancaires (Groupement CB â€” critical for FR cards), SEPA, Bancontact, PayPal. iDEAL not (that's NL).
- **Currency:** EUR. PPP tier: 0.90x US.
- **Tax:** TVA 20% standard. OSS for cross-border.
- **Invoice format:** Code gÃ©nÃ©ral des impÃ´ts requirements â€” SIREN/SIRET of issuer (if French entity), VAT number, complete addresses, sequential number, description, breakdown by VAT rate. E-invoicing (Chorus Pro for B2G; B2B mandate phased 2026â€“2027 via Factur-X / PDP).
- **Reverse charge / B2B:** Yes â€” collect/validate EU VAT ID.
- **Fraud patterns:** Low; CB network has high security (3DS2 + biometrics dominant).
- **Refund:** 14 days; refund within 14 days of withdrawal notice.

## C. Compliance Frameworks

- **Compliance agent rules:** GDPR + LIL, EU AI Act, Loi Toubon, Loi Naegelen, LCEN, Code de la consommation, ARCEP for any telecom-classified service.
- **Data residency:** No strict mandate generally; public sector â€” SecNumCloud certification often required (out of scope Year 1).
- **Cross-border transfers:** Same as EU â€” SCCs / DPF.
- **Subject access:** 1 month.
- **Breach notification:** 72 hours to CNIL.
- **Industry overlay:** Health data â€” HDS (HÃ©bergement de DonnÃ©es de SantÃ©) certification required for any healthcare customers (defer to Year 2).

## D. Content & Localization

- **Language:** FR-FR at launch (NOT FR-CA).
- **Cultural adaptation:** Loi Toubon â€” all customer-facing French; English permitted only when accompanied by French. Trust signals â€” Trustpilot FR, "Made in France" if applicable, RGPD compliance badge, "DonnÃ©es hÃ©bergÃ©es en Europe." Formal vous-form initially; tu-form possible if young/casual brand.
- **Diverging industries:** Auto-entrepreneur / micro-entreprise services (huge SMB segment); courtiers d'assurance; coachs (regulated since recent laws); immobilier (TI Hoguet card licensing); restauration.
- **Formatting:** DD/MM/YYYY; 24-hour; 1 234,56 â‚¬ (space thousands, comma decimal, space before â‚¬); metric.
- **Phone:** +33; 06/07 mobile; 01â€“05 geographic.
- **Address:** NumÃ©ro + voie, CP + Ville. Validate via La Poste / Cedex codes.
- **Banned topics:** Gambling without ANJ license; tobacco/alcohol with Loi Ã‰vin restrictions; medical advertising under CSP.

## E. Support Operations

- **Time zone:** CET/CEST. EU team.
- **Language:** FR, EN.
- **Moderation:** Loi Avia replaced by DSA framework; report CSAM via PHAROS.
- **Holidays:** Jour de l'An (Jan 1), Lundi de PÃ¢ques, FÃªte du Travail (May 1), Victoire 1945 (May 8), Ascension, Lundi de PentecÃ´te, FÃªte Nationale (Jul 14), Assomption (Aug 15), Toussaint (Nov 1), Armistice (Nov 11), NoÃ«l. August generally low activity â€” entire FR market slow Jul 14â€“Aug 31.
- **Phone support:** 0805 freephone via Twilio.

## F. Hosting & Infrastructure

- **R2:** WEUR.
- **Postgres:** AWS eu-west-3 (Paris) primary; eu-central-1 DR.
- **CDN:** Cloudflare CDG/MRS.
- **Email:** SendGrid EU; strict opt-in for FR.
- **DIDs:** Twilio FR DIDs (require local address verification â€” Arcep rules).

## G. Marketing

- **Ad creative:** Native FR-FR; tone â€” articulate, slightly intellectual, avoid US hype.
- **Influencers:** Yomi Denzel (e-commerce/business), Stan Leloup (Marketing Mania), ThÃ©o Lion (LinkedIn), Olivier Roland, CÃ©dric Annicette (entrepreneurship).
- **Communities:** France Digitale, Bpifrance Le Hub, La French Tech, Station F community, Maddyness Slack.
- **PR:** Les Ã‰chos, Maddyness, FrenchWeb, BFM Business, Le Figaro Ã‰conomie.
- **Case studies:** Paris SaaS, Lyon B2B, Lille services, Marseille e-comm.
- **Affiliates:** Awin FR, Effiliation, Tradedoubler, Kwanko.

## H. Integration Status

- **Platforms:** Google, Meta, LinkedIn, TikTok. Local â€” Welcome to the Jungle for hiring (not relevant); Doctolib for medical (out of scope).
- **Stripe:** Full FR support incl Cartes Bancaires.
- **Calendar:** Google + M365.

## I. Launch Phasing

- **60-day:** EU rep; CNIL contact established; Loi Toubon audit; Bloctel access; e-invoicing roadmap; AI Act gap.
- **Launch week:** FR locale; CB enabled; opt-in flows audited; vacation-aware support routing for August.
- **30-day:** CNIL inquiry drill; ANJ/ANSM/ACPR scan for vertical restrictions in customer base.
- **90-day:** Loi Toubon final audit; case studies; consider France SAS if hiring.

## J. Owner

- **Owner:** France Country Lead (Paris, hire Month 5).
- **Local partner:** Prighter / VeraSafe (Art 27 rep).
- **Legal counsel:** Gide or De Gaulle Fleurance.

---

# 9. India

## A. Legal & Regulatory

- **Local counsel:** Cyril Amarchand Mangaldas; Shardul Amarchand Mangaldas; AZB & Partners; Khaitan & Co; Nishith Desai Associates (tech specialty); for data/tech â€” Ikigai Law, Spice Route Legal.
- **ToS / Privacy Policy:** English acceptable; Hindi or regional optional. Reference DPDP Act 2023 + IT Act + Consumer Protection Act 2019. Grievance Officer contact (IT Rules) on site.
- **AI disclosure:** No comprehensive AI law yet. MeitY advisories (2024 advisory rescinded but signaled direction); upcoming "Digital India Act" expected to address AI. Disclose AI interaction.
- **Telemarketing:** TRAI Telecom Commercial Communications Customer Preference Regulations (TCCCPR 2018) + DLT (Distributed Ledger Technology) registration for all SMS senders; header + template pre-approval. DND (Do Not Disturb) registry mandatory. Strict â€” telecom operators block non-registered traffic. For voice â€” same DLT regime.
- **Anti-spam:** TCCCPR for SMS/voice; for email â€” Consumer Protection Act + IT Act. Soft regulation but opt-out required.
- **Data protection:** DPDP Act 2023 (Digital Personal Data Protection Act) â€” rules pending notification as of late 2025. Once in force: consent, notice, data fiduciary obligations, Data Protection Board (DPB). Children = under 18. Significant Data Fiduciary may have stricter duties.
- **Consumer rights:** Consumer Protection Act 2019 + E-Commerce Rules 2020 â€” grievance redressal officer mandatory, response within 48 hours / resolution within 30 days. Cooling-off varies by goods; SaaS â€” refund per contract.
- **Sector-specific:** SEBI for investments; RBI for fintech; IRDAI for insurance; MCI/NMC for medical; Bar Council for legal lead-gen (very restrictive).
- **Local entity:** Not required for SaaS export, but Equalisation Levy 2% on non-resident e-commerce supply to India was phased out August 2024 â€” now subject to broader BEPS rules. GST registration for non-resident OIDAR provider required when supplying digital services to Indian customers. Appoint Authorized Representative.

## B. Payment Rails

- **Primary rail:** Stripe India onboarding still limited â€” use Razorpay (UPI, cards, netbanking, wallets) as primary; Stripe global for international cards; PayPal as backup. UPI dominant â€” must support.
- **Currency:** INR. PPP tier: 0.30x US (significant discount tier).
- **Tax:** GST 18% on most SaaS. Non-resident OIDAR providers must register, collect, and remit GST on B2C; B2B reverse charge if customer GST-registered. Stripe Tax + Razorpay handle.
- **Invoice format:** GST tax invoice with GSTIN of supplier (and recipient if registered), HSN/SAC code, place of supply, taxable value + IGST/CGST+SGST breakdown. E-invoicing mandatory for B2B if turnover >â‚¹5 crore via IRP.
- **Reverse charge / B2B:** Yes â€” collect GSTIN, validate via GST portal.
- **Fraud patterns:** High volume of failed cards (issuer declines common); UPI more reliable; subscription challenges since RBI 2021 e-mandate rules â€” many cards reject recurring (use UPI Autopay).
- **Refund:** 5â€“7 days for UPI; cards similar; honor 30-day policy. RBI sets refund timelines for payment failures.

## C. Compliance Frameworks

- **Compliance agent rules:** DPDP Act 2023, IT Act 2000 + IT Rules 2021 (intermediary obligations, Grievance Officer), Consumer Protection Act + E-Comm Rules, TCCCPR, GST rules, RBI cross-border payment rules.
- **Data residency:** Sector-specific localization (RBI payment data â€” full localization in India; SEBI for capital markets data). DPDP Act includes whitelist mechanism â€” government can restrict transfer to specific countries.
- **Cross-border transfers:** DPDP allows except to "negative-listed" countries (TBD). RBI payment-system data must mirror in India.
- **Subject access:** DPDP Act timelines pending rules; expect ~30 days.
- **Breach notification:** CERT-In 6-hour incident reporting rule (2022 directive) â€” applies broadly to body corporates; very tight. DPB notification under DPDP per rules.
- **Industry overlay:** Fintech/payments â€” RBI sandbox; data localization heavy.

## D. Content & Localization

- **Language:** EN (Indian English) at launch; Hindi UI by Month 6; Tamil/Telugu/Bengali/Marathi/Gujarati phased Year 2.
- **Cultural adaptation:** Trust signals â€” Razorpay/payment logos, GSTIN visible, ISO 27001; testimonials reference Tier-1/Tier-2 cities; entrepreneur respect tone; family-business friendly; numeric tradition â€” use lakh/crore (â‚¹1,00,000 / â‚¹1,00,00,000) for INR amounts.
- **Diverging industries:** EdTech (huge â€” coaching institutes, test prep); D2C e-comm boom; insurance agents (huge POS network); real estate brokers (RERA registration); financial planners (SEBI registration).
- **Formatting:** DD/MM/YYYY or DD-MM-YYYY; 12-hour common; â‚¹ 1,00,000.00 (Indian numbering); metric.
- **Phone:** +91; mobile 6/7/8/9 prefix; STD codes for landlines.
- **Address:** House/Flat # + Street, Locality, City, State, PIN (6 digits).
- **Banned topics:** Crypto-related advertising heavily restricted; online gambling regulated state-by-state (TN, KA, AP ban); religious/political ads sensitive; medical advertising heavily restricted (Drugs and Magic Remedies Act).

## E. Support Operations

- **Time zone:** IST. APAC team or India local â€” 9amâ€“9pm IST.
- **Language:** EN, Hindi (Month 6); other regional follow.
- **Moderation:** IT Rules 2021 â€” Grievance Officer, Resident Grievance Officer (for Significant Social Media Intermediaries â€” not us at launch); takedown timelines.
- **Holidays:** Republic Day (Jan 26), Holi (varies), Independence Day (Aug 15), Gandhi Jayanti (Oct 2), Diwali (varies), Christmas. Many regional optional holidays â€” Eid, Pongal, Onam, Durga Puja, Ganesh Chaturthi.
- **Phone support:** Toll-free 1800 via Twilio India (requires entity or partner).

## F. Hosting & Infrastructure

- **R2:** APAC.
- **Postgres:** AWS ap-south-1 (Mumbai) primary; ap-south-2 (Hyderabad) DR.
- **CDN:** Cloudflare BOM/DEL/HYD/MAA/BLR/CCU edges.
- **Email:** SendGrid + local provider Pepipost/Netcore for IN deliverability.
- **DIDs:** Twilio IN requires KYC + local entity or partner; consider Exotel or Knowlarity for Indian numbers + IVR.

## G. Marketing

- **Ad creative:** Native Indian English first; Hindi by Month 6; family/aspirational tone; trust + value-for-money lead messages.
- **Influencers:** Ankur Warikoo, Sahil Bloom (US but huge IN audience), Varun Mayya, Raj Shamani, Tanmay Bhat (business content), CA Rachana Ranade (finance), Pranjal Kamra.
- **Communities:** Nasscom 10K Startups, TiE Bangalore/Delhi/Mumbai, GrowthX, IndiaSaaS Slack, Headstart Network, SaaSBOOMi.
- **PR:** YourStory, Inc42, Entrackr, Moneycontrol, Economic Times Tech, Mint, The Ken.
- **Case studies:** Bangalore SaaS, Mumbai D2C, Delhi services, Hyderabad EdTech, Tier-2 (Indore/Jaipur) SMB.
- **Affiliates:** vCommission, INRDeals, Cuelinks; SaaSBOOMi affiliate marketers.

## H. Integration Status

- **Platforms:** Google, Meta, LinkedIn, X dominant; Sharechat (regional language); Moj; ShareChat for vernacular. WhatsApp Business absolutely critical â€” 70%+ business comms. Truecaller integration valuable for caller ID trust.
- **Stripe:** Limited; use Razorpay primary.
- **Calendar:** Google dominant; M365 enterprise.

## I. Launch Phasing

- **60-day:** Counsel review DPDP readiness; CERT-In 6-hour incident process; Grievance Officer designated; Razorpay merchant onboarding (~3â€“4 weeks); OIDAR GST registration; DLT registration for SMS templates (via Razorpay or Karix); WhatsApp Business API verification.
- **Launch week:** EN-IN locale; UPI live; lakh/crore formatting; toll-free IN number; Grievance Officer email live.
- **30-day:** First CERT-In drill; chargeback monitor; UPI Autopay activation; Hindi roadmap kickoff.
- **90-day:** Hindi UI beta; DPDP rules-readiness review; case studies; consider Indian Private Limited if hiring local.

## J. Owner

- **Owner:** India Country Lead (Bangalore or Bombay, hire Month 4 â€” local context required).
- **Local partner:** Razorpay (payments), Nishith Desai (DPDP advisory), Exotel/Knowlarity (telephony), Karix (SMS DLT).
- **Legal counsel:** Nishith Desai Associates (primary).

---

# 10. Japan

## A. Legal & Regulatory

- **Local counsel:** Nishimura & Asahi; Mori Hamada & Matsumoto; Anderson Mori & Tomotsune; Nagashima Ohno & Tsunematsu; for tech/data â€” TMI Associates, Atsumi Sakai.
- **ToS / Privacy Policy:** Japanese (JA) required for consumer-facing â€” Act on Specified Commercial Transactions (ç‰¹å•†æ³•) mandates clear seller info disclosure (legal name, address, phone, representative, return policy) for online commerce. Privacy notice per APPI (å€‹äººæƒ…å ±ä¿è­·æ³•).
- **AI disclosure:** AI Bill 2025 (æ³•å¾‹) â€” Japan's framework-level AI law passed May 2025 â€” broad principles, light touch, METI/PPC guidance for specifics. Transparency expectation. PPC has AI guidance. Generative AI training data â€” copyright considerations under Article 30-4 of Copyright Act.
- **Telemarketing:** Act on Specified Commercial Transactions â€” prohibits repeat solicitation after refusal; pre-call disclosure required. JIAA self-regulation for online advertising. No central DNC registry as comprehensive as US, but consumer affairs agency strong.
- **Anti-spam:** Act on Regulation of Transmission of Specified Electronic Mail â€” opt-in required for marketing email; sender ID required; unsubscribe must work. Fines + criminal penalties.
- **Data protection:** APPI (Act on the Protection of Personal Information). PPC (Personal Information Protection Commission) regulator. 2022 amendment expanded extraterritoriality and breach reporting. Pseudonymized/anonymized data definitions specific.
- **Consumer rights:** Specified Commercial Transactions Act + Consumer Contract Act â€” cooling-off in specified categories (door-to-door, telemarketing); online B2C SaaS usually contract-governed but standard form clauses void if unilaterally disadvantageous. Important â€” clear cancellation flow legally required.
- **Sector-specific:** FSA for financial; MHLW/PMDA for medical; JFTC for advertising; Bar Association for legal.
- **Local entity:** Not required for SaaS export, but business operations with continuous presence may trigger KK (Kabushiki Kaisha) or branch registration. Consumption Tax registration required when taxable sales exceed JPY 10M annually (over 2 years prior) â€” foreign digital services rules apply. Appoint domestic agent under APPI 2022 reform when targeting Japanese residents.

## B. Payment Rails

- **Primary rail:** Stripe (JPY) â€” cards, Konbini (convenience store cash), bank transfers. PayPay (mobile wallet) via Stripe in beta. PayPal secondary. Local card brands JCB critical (Stripe supports).
- **Currency:** JPY. PPP tier: 0.85x US (but psychological pricing â€” round JPY amounts: Â¥4,980 vs $49.80).
- **Tax:** Consumption Tax 10% (8% reduced for some food/news â€” not us). Foreign digital service providers must register under "consumption tax on cross-border B2C digital services" rules. B2B reverse charge for registered customers.
- **Invoice format:** Qualified Invoice System (é©æ ¼è«‹æ±‚æ›¸) since Oct 2023 â€” must include qualified invoice issuer registration number for customers to claim input credit. Register with NTA as Qualified Invoice Issuer.
- **Reverse charge / B2B:** Yes â€” collect invoice issuer number, apply reverse charge for B2B if applicable.
- **Fraud patterns:** Low fraud rate; very high card-on-file expectations; cash-on-delivery / Konbini still popular for trust.
- **Refund:** Cooling-off N/A for most online SaaS but cancellation must be easy; honor 30-day policy.

## C. Compliance Frameworks

- **Compliance agent rules:** APPI 2022, Act on Specified Commercial Transactions, Act on Regulation of Transmission of Specified Electronic Mail, AI Bill 2025, Consumer Contract Act, Act Against Unjustifiable Premiums and Misleading Representations.
- **Data residency:** APPI does not mandate; PPC has issued adequacy decision for EU; cross-border transfers require consent/equivalent measures.
- **Cross-border transfers:** APPI Article 28 â€” consent + provision of info on recipient country + protection equivalent. Japan-EU mutual adequacy.
- **Subject access:** Generally without undue delay; APPI 2022 sets request handling expectations.
- **Breach notification:** APPI 2022 â€” report to PPC promptly (within ~3â€“5 days for preliminary) and to individuals when high risk.
- **Industry overlay:** Number Act (My Number) â€” if any government ID handling, strict rules â€” not relevant at launch.

## D. Content & Localization

- **Language:** JA at launch (Month 4 â€” JA adds a quarter to launch).
- **Cultural adaptation:** Trust signals â€” Privacy Mark (Pãƒžãƒ¼ã‚¯ â€” JIPDEC), TRUSTe Japan, JIS Q 15001 references, ISMS, Tokutei ShÅtorihiki disclosure block prominent, "é‹å–¶ä¼šç¤¾" (operating company) block on every page; testimonials with company name + role (more institutional than personal); formal tone (æ•¬èªž); avoid hype.
- **Diverging industries:** Real estate (å®…å»ºå£« license required for property advertising); insurance agents; tax/accounting practitioners; cram schools (juku â€” big EdTech segment); restaurant owners (huge SMB segment); local services (Koukoku/Tokutei rules).
- **Formatting:** YYYY/MM/DD or YYYYå¹´MMæœˆDDæ—¥; 24-hour; Â¥1,234 (no decimals usually); metric.
- **Phone:** +81; mobile 070/080/090.
- **Address:** Postal code (ã€’XXX-XXXX) â†’ prefecture â†’ city â†’ ward â†’ block-building (specific Japanese addressing). Use a service like Janome or YubinBango for postal lookup.
- **Banned topics:** Pachinko marketing restricted; medical advertising restricted; cosmetics claims must comply with Pharmaceuticals and Medical Devices Act; financial product advertising under FIEA.

## E. Support Operations

- **Time zone:** JST. APAC team â€” Tokyo hours 9amâ€“6pm critical.
- **Language:** JA, EN backup.
- **Moderation:** Provider Liability Limitation Act â€” takedown procedures.
- **Holidays:** New Year (Jan 1 + ~3 days observed), Coming of Age Day (2nd Mon Jan), National Foundation Day (Feb 11), Emperor's Birthday (Feb 23), Vernal Equinox (Mar), Showa Day (Apr 29), Constitution Memorial (May 3), Greenery (May 4), Children's Day (May 5), Marine Day (3rd Mon Jul), Mountain Day (Aug 11), Respect for the Aged (3rd Mon Sep), Autumnal Equinox (Sep), Health & Sports (2nd Mon Oct), Culture (Nov 3), Labor Thanksgiving (Nov 23). Golden Week (Apr 29â€“May 5) and Obon (mid-Aug) effectively shut businesses.
- **Phone support:** 0120 toll-free via Twilio (requires local verification).

## F. Hosting & Infrastructure

- **R2:** APAC.
- **Postgres:** AWS ap-northeast-1 (Tokyo) primary; ap-northeast-3 (Osaka) DR.
- **CDN:** Cloudflare NRT/HND/KIX edges.
- **Email:** SendGrid Tokyo region; double opt-in mandatory.
- **DIDs:** Twilio JP DIDs require local entity verification â€” start at Month 2.

## G. Marketing

- **Ad creative:** Native JA; visual-led; trust signals heavy; formal language; case study + numerical proof preferred over personality.
- **Influencers:** Manabu Bannai (ãƒžãƒŠãƒ– â€” blog/YT entrepreneur), Mocchi (mocchi blog), Daigo (mentalist â€” broad), Sho Tanaka (Twitter business), Yusuke Wada, b2b â€” Atsumi Suzuki.
- **Communities:** Slack communities â€” Indie Hackers Japan, Startup Weekend Japan; Open Network Lab; J-Startup; ITmedia; SaaS.tech.
- **PR:** TechCrunch Japan (closed 2022 but JP outlets reborn â€” BridgeTokyo, The Bridge, ITmedia NEWS), Nikkei XTech, ASCII, IT mediaãƒ“ã‚¸ãƒã‚¹, MarkeZine, Forbes Japan.
- **Case studies:** Tokyo SaaS, Osaka SMB, Fukuoka startup; ideally well-known Japanese company logos before scale.
- **Affiliates:** A8.net (Japan's largest), Value Commerce, Rakuten Affiliate, Cross-A.

## H. Integration Status

- **Platforms:** Google, Meta, X (Japan #2 X market), LINE Ads + LINE Official Account (essential â€” bake into RevTry/CRM), Yahoo! Japan Ads (still relevant â€” Yahoo JP dominant portal), TikTok growing. LinkedIn weak in JP â€” use Wantedly for hiring (N/A to product).
- **Communication:** LINE > WhatsApp in Japan â€” must integrate LINE Official Account messaging.
- **Stripe:** Full JP support.
- **Calendar:** Google dominant in startups; M365 enterprise; some legacy users on Cybozu Garoon / SaibÅzu â€” Garoon integration valuable for enterprise.

## I. Launch Phasing

- **60-day:** JA translation w/ native localizer (not MT); APPI domestic agent appointed; counsel review JA ToS + Tokutei ShÅtorihiki block; Qualified Invoice Issuer registration; Privacy Mark scoping; LINE Business account setup.
- **Launch week:** JA locale live; Tokutei ShÅtorihiki block on site footer; Konbini + JCB live; JA support staffed Tokyo hours.
- **30-day:** First APPI/PPC inquiry drill; LINE Official integration ship.
- **90-day:** Privacy Mark application; Yahoo! Japan Ads integration; case studies; consider KK if hiring.

## J. Owner

- **Owner:** Japan Country Lead (Tokyo, hire Month 6 â€” bilingual JA/EN essential).
- **Local partner:** TMI Associates (APPI domestic agent role), Janome (postal/address), Privacy Mark consultant (JIPDEC).
- **Legal counsel:** Nishimura & Asahi or Mori Hamada (primary).

---

# 11. Countries we won't launch in Year 1

We are deliberately not extending operational support to the following five jurisdictions for Year 1. Customers from these countries may sign up via best-effort EN/global tier but receive no localized support, no in-country payment rails, and no marketing investment, and we may geo-restrict signup entirely where compliance risk is unacceptable.

## 1. China (PRC mainland)

**Why not Year 1:** PIPL (Personal Information Protection Law) is comparable to GDPR in scope but pairs with CSL + DSL â€” and the data residency / Critical Information Infrastructure rules effectively require local entity, ICP license, and in-country hosting on a CAC-approved provider. CAC security assessment for outbound data transfers can take 6â€“12 months. State Secrets Law and Counter-Espionage Law create unbounded compliance risk for an AI product that processes communications data. Generative AI services targeting PRC users require approval under the Interim Measures for Generative AI Services â€” algorithm filing with CAC. Foreign payment rails are restricted; would require Alipay/WeChat Pay integration through a PRC entity. Cumulative cost + risk + revenue ceiling for an early-stage company points to "no" until at least Year 3 and only via a separate PRC subsidiary or a licensee model. **Geo-restrict signup. Block PRC IPs.**

## 2. Russia

**Why not Year 1:** Active US/EU/UK sanctions (OFAC, EU Council, OFSI) restrict provision of certain IT services to Russia. EO 14071 (US) prohibits certain "software services" exports to Russia. Sanctions risk is too high and customer-acquisition value too low. Federal Law 152-FZ on Personal Data requires Russian citizens' data to be stored on Russian-territory servers (data localization), and Roskomnadzor enforces with website blocking. **Geo-restrict signup. Block RU IPs.**

## 3. Iran, North Korea, Syria, Cuba, Crimea/DNR/LNR (sanctions-restricted)

**Why not Year 1:** Comprehensive US sanctions (OFAC SDN, EAR, ITAR overlays) prohibit virtually all commercial transactions. EU and UK aligned sanctions. **Geo-restrict signup at the IP/registration layer; require sanctions screening (Refinitiv World-Check or ComplyAdvantage) on every signup.** This category is non-negotiable and an obvious "no."

## 4. South Korea

**Why not Year 1 (deferred to early Year 2):** Strong market and excellent target but PIPA (Personal Information Protection Act) compliance is non-trivial â€” local representative required for foreign businesses, ISMS-P (Korean information security) certification expected by enterprise buyers, K-ISA breach reporting clock is very tight (24 hours), and the prior consent regime is stricter than GDPR (granular checkbox per purpose, age-13 children protection, separate consent for marketing vs. service). KakaoTalk integration is mandatory for go-to-market â€” distinct API/business approval. Naver Ads + KakaoTalk Channel integration adds another 4â€“6 weeks engineering. Deferral is about sequencing, not viability â€” **target Q2 Year 2 with proper investment.**

## 5. South Africa / Nigeria / Egypt and broader Africa (deferred)

**Why not Year 1:** Each African market has distinct compliance regimes (POPIA in ZA, NDPR/NDP Act in NG, PDPL in EG, Kenya DPA, Ghana DPA) and payment rails are highly fragmented (Paystack, Flutterwave for NG/ZA; M-Pesa for KE; Fawry for EG). Cumulative localization cost is high and the early customer base is unlikely to justify the 60+ day pre-launch checklist per country. We will accept EN-language self-service signups from African countries (with sanctions screening) and revisit a Sub-Saharan Africa launch (likely starting Nigeria + South Africa with Paystack/Flutterwave) in Q3 Year 2 once we have local-rail support architecture from India and Brazil work.

**Other deferrals worth noting (informally):** Italy, Spain, Netherlands, Sweden, Switzerland, UAE, Singapore â€” these are EU/EFTA or APAC markets where we will accept signups via the regional EU/APAC tier and provide EN-language support, but we will not invest in country-specific localization, payment rails, or marketing until Year 2. Singapore and UAE are the strongest candidates for an early Year 2 add given English-business culture and clean regulatory regimes (PDPA SG, UAE PDPL + DIFC/ADGM).

---

# Cross-cutting reference: Owner & escalation matrix

| Country | Owner role | Hire by | Counsel firm | Local partner |
|---|---|---|---|---|
| US | US Country Lead | Month 0 (CEO interim) | Cooley + Klein Moynihan Turco | â€” |
| UK | UK & Ireland Lead | Month 4 | Bird & Bird | VeraSafe (Art 27) |
| CA | Canada Lead | Month 5 | Osler + Fasken (QC) | â€” |
| AU | ANZ Lead | Month 6 | Gilbert + Tobin | â€” |
| MX | LATAM Lead (MX) | Month 5 | Creel GarcÃ­a-CuÃ©llar | Facturama |
| BR | Brazil Lead | Month 3 | Pinheiro Neto + Opice Blum | NFE.io |
| DE | DACH Lead | Month 4 | Hengeler Mueller | Prighter / Trusted Shops |
| FR | France Lead | Month 5 | Gide Loyrette Nouel | Prighter |
| IN | India Lead | Month 4 | Nishith Desai | Razorpay + Exotel + Karix |
| JP | Japan Lead | Month 6 | Nishimura & Asahi | TMI Associates + JIPDEC |

# Cross-cutting reference: Compliance framework coverage required of compliance agent

The compliance agent (per engineering ops spec) must encode rules from at minimum the following frameworks, with a country-tag on each rule so that the agent can resolve which apply based on lead / customer / sender / recipient location:

CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA, TDPSA, OCPA, MCDPA, DPDPA (Delaware), TCPA, CAN-SPAM, COPPA, FTC Section 5, CO AI Act, CA SB 942, CA AB 2013, UT AI Policy Act, TX TRAIGA, UK GDPR, DPA 2018, PECR, ASA CAP/BCAP, Online Safety Act, Consumer Rights Act, PIPEDA, Quebec Law 25, AB PIPA, BC PIPA, CASL, CRTC Telecom Rules, Bill 96, Privacy Act 1988 + APPs, Spam Act 2003, DNC Register Act, ACL, ASIC DDO, LFPDPPP, LFPC, CFDI rules, Ley Fintech, LGPD, CDC, Marco Civil, PL 2338 (when in force), ANPD resolutions, GDPR, BDSG, EU AI Act, TTDSG/ePrivacy, UWG, BGB consumer, TMG/DDG (Impressum), Loi Toubon, LIL, Loi Naegelen, LCEN, Code de la consommation, DPDP Act 2023, IT Act + IT Rules 2021, Consumer Protection Act + E-Comm Rules 2020, TCCCPR, CERT-In 6-hr rule, GST/OIDAR rules, APPI, Specified Commercial Transactions Act, Specified Electronic Mail Act, Japan AI Bill 2025, Consumer Contract Act, Qualified Invoice System.

End of document.
