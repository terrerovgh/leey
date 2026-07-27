import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, Send, CheckCircle2 } from "lucide-react";
import { Section } from "./Section";
import { Reveal } from "./Reveal";
import { useI18n } from "../i18n";
import { SITE } from "../lib/site";

export function Contact() {
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newErrors: Record<string, string> = {};
    if (!fd.get("name")) newErrors.name = "Required";
    if (!fd.get("email") || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(fd.get("email"))))
      newErrors.email = "Valid email required";
    if (!fd.get("message")) newErrors.message = "Required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSending(true);
    const subject = encodeURIComponent(`Web — ${fd.get("name")}`);
    const body = encodeURIComponent(
      `Name: ${fd.get("name")}\nEmail: ${fd.get("email")}\nPhone: ${fd.get("phone") || "—"}\n\n${fd.get("message")}`,
    );
    setTimeout(() => {
      setSending(false);
      setSent(true);
      window.location.href = `mailto:${SITE.agent.email}?subject=${subject}&body=${body}`;
    }, 500);
  };

  return (
    <Section
      id="contact"
      eyebrow={t.contact.eyebrow}
      title={t.contact.title}
      subtitle={t.contact.subtitle}
      tone="paper"
    >
      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-7">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field name="name" label={t.contact.formName} error={errors.name} autoComplete="name" />
              <Field name="email" label={t.contact.formEmail} type="email" error={errors.email} autoComplete="email" />
              <Field name="phone" label={t.contact.formPhone} type="tel" autoComplete="tel" />
              <div className="sm:col-span-2">
                <Field name="message" label={t.contact.formMessage} textarea error={errors.message} />
              </div>
            </div>
            <p className="text-xs text-ink-400">{t.contact.formPrivacy}</p>
            <motion.button
              type="submit"
              disabled={sending || sent}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-ink-900 px-7 py-3.5 text-sm font-medium tracking-wide text-ivory-50 transition hover:bg-clay-600 disabled:opacity-50"
            >
              {sent ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t.contact.formSent}
                </>
              ) : sending ? (
                t.contact.formSending
              ) : (
                <>
                  {t.contact.formSend}
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </motion.button>
          </form>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.06}>
          <div className="space-y-6 border-t hairline pt-8 lg:border-t-0 lg:border-l lg:pl-12 lg:pt-0">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                {t.contact.phone}
              </div>
              <a
                href={`tel:${SITE.agent.phoneTel}`}
                className="mt-2 inline-flex items-center gap-2 text-lg font-medium text-ink-900 transition hover:text-clay-600"
              >
                <Phone className="h-4 w-4 text-clay-500" />
                {SITE.agent.phoneDisplay}
              </a>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                {t.contact.email}
              </div>
              <a
                href={`mailto:${SITE.agent.email}`}
                className="mt-2 inline-flex items-center gap-2 text-base font-medium text-ink-900 transition hover:text-clay-600"
              >
                <Mail className="h-4 w-4 text-clay-500" />
                {SITE.agent.email}
              </a>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                {t.contact.hours}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Field({
  name,
  label,
  type = "text",
  textarea,
  error,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  textarea?: boolean;
  error?: string;
  autoComplete?: string;
}) {
  const base =
    "w-full border-0 border-b border-ink-900/15 bg-transparent px-0 py-3 text-sm text-ink-900 placeholder:text-ink-300 transition focus:border-clay-500 focus:outline-none focus:ring-0";
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        {label}
      </span>
      {textarea ? (
        <textarea name={name} rows={3} className={`${base} resize-none ${error ? "border-red-400" : ""}`} />
      ) : (
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          className={`${base} ${error ? "border-red-400" : ""}`}
        />
      )}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
