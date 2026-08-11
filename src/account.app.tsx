import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

type Profile = {
  name: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  notes: string;
};

type Ticket = {
  id: string;
  subject: string;
  detail: string;
  created: number;
  sent: boolean;
};

type Stored = {
  active: boolean;
  profile: Profile;
  tickets: Ticket[];
  savedAt: number | null;
};

const KEY = "tekriohub.account.v1";
const SUPPORT_EMAIL = "hello@tekriohub.com";
const SUPPORT_PHONE = "+44 20 3355 1180";

const SERVICES = [
  "Managed IT support",
  "Cloud migration (Microsoft 365 / Google)",
  "Website design and build",
  "Network and Wi-Fi setup",
  "Backup and recovery",
  "Something else",
];

const EMPTY_PROFILE: Profile = {
  name: "",
  email: "",
  phone: "",
  company: "",
  service: SERVICES[0],
  notes: "",
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return mins + " minutes ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : hrs + " hours ago";
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : days + " days ago";
}

function mailtoFor(subject: string, body: string): string {
  return (
    "mailto:" +
    SUPPORT_EMAIL +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}

function App() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [flash, setFlash] = useState("");

  const [linkEmail, setLinkEmail] = useState("");
  const [linkState, setLinkState] = useState<"idle" | "sending" | "sent">("idle");
  const [linkError, setLinkError] = useState("");

  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [noteError, setNoteError] = useState("");

  const load = useCallback(() => {
    setPhase("loading");
    setLoadError("");
    window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Stored;
          setActive(Boolean(parsed.active));
          setProfile({ ...EMPTY_PROFILE, ...(parsed.profile || {}) });
          setTickets(Array.isArray(parsed.tickets) ? parsed.tickets : []);
          setSavedAt(typeof parsed.savedAt === "number" ? parsed.savedAt : null);
        }
        setPhase("ready");
      } catch (err) {
        setLoadError(
          "We could not read the details stored in this browser. Private browsing or a full cache can cause that."
        );
        setPhase("error");
      }
    }, 450);
  }, []);

  useEffect(load, [load]);

  const write = useCallback(
    (next: Stored) => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
        return true;
      } catch (err) {
        setFlash("This browser blocked local storage, so nothing was kept on this device.");
        return false;
      }
    },
    []
  );

  const persist = useCallback(
    (patch: Partial<Stored>) => {
      const next: Stored = {
        active,
        profile,
        tickets,
        savedAt,
        ...patch,
      };
      if (patch.active !== undefined) setActive(patch.active);
      if (patch.profile !== undefined) setProfile(patch.profile);
      if (patch.tickets !== undefined) setTickets(patch.tickets);
      if (patch.savedAt !== undefined) setSavedAt(patch.savedAt);
      write(next);
    },
    [active, profile, tickets, savedAt, write]
  );

  const requestLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(linkEmail)) {
      setLinkError("Please type the email address you use with us, for example jo@company.co.uk");
      return;
    }
    setLinkError("");
    setLinkState("sending");
    window.setTimeout(() => setLinkState("sent"), 900);
  };

  const openWorkspace = () => {
    persist({
      active: true,
      profile: { ...profile, email: profile.email || linkEmail.trim() },
      savedAt: savedAt,
    });
    setFlash("");
  };

  const saveProfile = () => {
    const ts = Date.now();
    persist({ savedAt: ts, profile });
    setFlash("Details saved in this browser at " + new Date(ts).toLocaleTimeString() + ".");
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) {
      setNoteError("Give the request a short title so we know what it is about.");
      return;
    }
    setNoteError("");
    const ticket: Ticket = {
      id: String(Date.now()),
      subject: subject.trim(),
      detail: detail.trim(),
      created: Date.now(),
      sent: false,
    };
    persist({ tickets: [ticket, ...tickets] });
    setSubject("");
    setDetail("");
  };

  const markSent = (id: string) => {
    persist({ tickets: tickets.map((t) => (t.id === id ? { ...t, sent: true } : t)) });
  };

  const removeTicket = (id: string) => {
    persist({ tickets: tickets.filter((t) => t.id !== id) });
  };

  const eraseAll = () => {
    try {
      window.localStorage.removeItem(KEY);
    } catch (err) {
      /* nothing kept anyway */
    }
    setActive(false);
    setProfile(EMPTY_PROFILE);
    setTickets([]);
    setSavedAt(null);
    setLinkState("idle");
    setLinkEmail("");
    setFlash("Everything has been cleared from this browser.");
  };

  const openCount = useMemo(() => tickets.filter((t) => !t.sent).length, [tickets]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 text-ink">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">TekrioHub</p>
      <h1 className="font-display mt-2 text-4xl font-bold">My Account</h1>
      <p className="mt-3 max-w-2xl text-base text-ink/70">
        Your account area keeps the details we need when you call: who to contact, the kit you run, and
        the jobs you have asked us about. It takes about a minute to fill in.
      </p>

      {phase === "loading" && (
        <div className="card mt-8 p-6">
          <p className="text-sm text-ink/60">Checking this device for your saved details…</p>
          <div className="mt-4 space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-ink/10" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-ink/10" />
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="card mt-8 border border-red-200 p-6">
          <h2 className="font-display text-xl font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-ink/70">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn" onClick={load}>
              Try again
            </button>
            <a className="btn-secondary" href={mailtoFor("Account page trouble", "Hi TekrioHub,\n\n")}>
              Email us instead
            </a>
          </div>
        </div>
      )}

      {phase === "ready" && !active && (
        <div className="mt-8 grid gap-6 md:grid-cols-5">
          <section className="card md:col-span-3 p-6">
            {linkState !== "sent" ? (
              <>
                <h2 className="font-display text-2xl font-semibold">Sign in with an email link</h2>
                <p className="mt-2 text-sm text-ink/70">
                  No password to remember. Type your email and we send you a one-time link. If you would
                  rather not wait, you can fill your details in on this device and email them over when you
                  are ready.
                </p>
                <form className="mt-5 space-y-3" onSubmit={requestLink} noValidate>
                  <label className="block text-sm font-medium" htmlFor="acct-email">
                    Email address
                  </label>
                  <input
                    id="acct-email"
                    type="email"
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                    placeholder="jo@company.co.uk"
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                  />
                  {linkError && <p className="text-sm text-red-600">{linkError}</p>}
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button className="btn" type="submit" disabled={linkState === "sending"}>
                      {linkState === "sending" ? "Sending your link…" : "Email me a sign-in link"}
                    </button>
                    <button className="btn-secondary" type="button" onClick={openWorkspace}>
                      Fill it in on this device
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold">Check your inbox</h2>
                <p className="mt-2 text-sm text-ink/70">
                  We have your request for <span className="font-semibold">{linkEmail.trim()}</span>. One of
                  the team will get back to you with your link, usually the same working day. Nothing has
                  been stored on our side from this page.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink/70">
                  <li>Links expire after 15 minutes, so open it when you have a moment.</li>
                  <li>If it has not arrived, check junk mail or ring {SUPPORT_PHONE}.</li>
                </ul>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn" onClick={openWorkspace}>
                    Start filling in my details
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setLinkState("idle");
                      setLinkEmail("");
                    }}
                  >
                    Use a different address
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="card md:col-span-2 p-6">
            <h3 className="font-display text-lg font-semibold">What the account is for</h3>
            <ul className="mt-3 space-y-3 text-sm text-ink/75">
              <li>Keep your contact details and site address in one place.</li>
              <li>List the jobs you have asked about, with the notes you wrote at the time.</li>
              <li>Send any of it to our helpdesk in one click when you need us on site.</li>
            </ul>
            <p className="mt-5 text-sm text-ink/60">
              Helpdesk hours: Monday to Friday, 9am to 6pm. Out of hours cover is part of the managed
              support plans.
            </p>
            <a className="btn-secondary mt-4 inline-block" href={"mailto:" + SUPPORT_EMAIL}>
              {SUPPORT_EMAIL}
            </a>
          </aside>
        </div>
      )}

      {phase === "ready" && active && (
        <div className="mt-8 space-y-6">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-display text-2xl font-semibold">
                {profile.name.trim() ? "Hello, " + profile.name.trim().split(" ")[0] : "Your details"}
              </h2>
              <p className="mt-1 text-sm text-ink/60">
                {savedAt ? "Last saved " + timeAgo(savedAt) + " on this device." : "Nothing saved yet."}{" "}
                {openCount > 0 ? openCount + " request(s) not sent to us yet." : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-secondary" onClick={() => persist({ active: false })}>
                Close workspace
              </button>
              <button className="btn-secondary" onClick={eraseAll}>
                Erase from this device
              </button>
            </div>
          </div>

          {flash && (
            <p className="rounded-lg border border-brand-600/30 bg-brand-600/5 px-4 py-3 text-sm text-ink/80">
              {flash}
            </p>
          )}

          <section className="card p-6">
            <h3 className="font-display text-lg font-semibold">Contact and site</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium" htmlFor="f-name">
                  Your name
                </label>
                <input
                  id="f-name"
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="f-company">
                  Business name
                </label>
                <input
                  id="f-company"
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="f-email2">
                  Email
                </label>
                <input
                  id="f-email2"
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="f-phone">
                  Best phone number
                </label>
                <input
                  id="f-phone"
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="f-service">
                  Main service you use
                </label>
                <select
                  id="f-service"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  value={profile.service}
                  onChange={(e) => setProfile({ ...profile, service: e.target.value })}
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="f-notes">
                  Kit and access notes
                </label>
                <textarea
                  id="f-notes"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  placeholder="12 laptops, one NAS in the back office, alarm code held by reception."
                  value={profile.notes}
                  onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className="btn" onClick={saveProfile}>
                Save on this device
              </button>
              <a
                className="btn-secondary"
                href={mailtoFor(
                  "My details for TekrioHub",
                  "Name: " +
                    profile.name +
                    "\nBusiness: " +
                    profile.company +
                    "\nEmail: " +
                    profile.email +
                    "\nPhone: " +
                    profile.phone +
                    "\nService: " +
                    profile.service +
                    "\nNotes: " +
                    profile.notes +
                    "\n"
                )}
              >
                Send these details to us
              </a>
              <span className="text-sm text-ink/55">Stored in this browser only.</span>
            </div>
          </section>

          <section className="card p-6">
            <h3 className="font-display text-lg font-semibold">Your requests</h3>
            <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={addNote} noValidate>
              <input
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                placeholder="Title, e.g. Slow printer in studio"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <input
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none sm:col-span-2"
                placeholder="What is happening, and since when?"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
              <div className="sm:col-span-3">
                {noteError && <p className="mb-2 text-sm text-red-600">{noteError}</p>}
                <button className="btn" type="submit">
                  Add to my list
                </button>
              </div>
            </form>

            {tickets.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-ink/20 px-4 py-6 text-sm text-ink/60">
                Nothing on your list yet. Jot down anything playing up and it will be here next time you
                open this page.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {tickets.map((t) => (
                  <li key={t.id} className="rounded-lg border border-ink/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{t.subject}</p>
                      {t.sent ? (
                        <span className="rounded-full bg-brand-600/10 px-3 py-1 text-xs font-semibold text-brand-600">
                          Emailed to us
                        </span>
                      ) : (
                        <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
                          On your list
                        </span>
                      )}
                    </div>
                    {t.detail && <p className="mt-2 text-sm text-ink/70">{t.detail}</p>}
                    <p className="mt-2 text-xs text-ink/50">Added {timeAgo(t.created)}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <a
                        className="btn-secondary"
                        href={mailtoFor(
                          "Support request: " + t.subject,
                          t.detail +
                            "\n\n" +
                            (profile.company ? profile.company + "\n" : "") +
                            (profile.name ? profile.name + "\n" : "") +
                            (profile.phone ? profile.phone + "\n" : "")
                        )}
                        onClick={() => markSent(t.id)}
                      >
                        Email this to the helpdesk
                      </a>
                      <button className="btn-secondary" onClick={() => removeTicket(t.id)}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-sm text-ink/55">
            Everything on this page lives in your browser. Clearing your cache or using another computer
            will start you fresh. Need a hand? Call {SUPPORT_PHONE} or email {SUPPORT_EMAIL}.
          </p>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("tibly-app-root")!).render(<App />);