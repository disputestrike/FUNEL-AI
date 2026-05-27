/** First-party lead capture endpoint POST /v1/forms/:formId/submissions. */
export const FORM_SUBMIT_OK = {
  form_id: "form_test_1",
  workspace_id: "ws_test",
  funnel_id: "fn_test",
  fields: {
    name: "Test Lead",
    email: "lead@example.test",
    phone: "+15550001234",
  },
  consent: { tcpa: true, sms: true, marketing: true },
  utm: { utm_source: "meta", utm_campaign: "launch" },
  recaptcha_token: "test-recaptcha-token",
};

export const FORM_SUBMIT_BOT = {
  ...FORM_SUBMIT_OK,
  honeypot: "bot-fill-this", // honeypot trap filled => spam
  recaptcha_token: "low-score",
};

export const FORM_SUBMIT_MISSING_CONSENT = {
  ...FORM_SUBMIT_OK,
  consent: { tcpa: false, sms: false, marketing: false },
};
