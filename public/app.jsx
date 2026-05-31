const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brand": "#C77B54",
  "accent": "#129684",
  "autoplay": true
}/*EDITMODE-END*/;

// Warm brand palettes for Claire (base → strong → tint → ring)
const BRANDS = {
  "#C77B54": { strong: "#A85F3B", tint: "#F6E7DC", ring: "rgba(199,123,84,0.24)" },
  "#CE9457": { strong: "#A8723A", tint: "#F8EDDD", ring: "rgba(206,148,87,0.24)" },
  "#B5654A": { strong: "#934A33", tint: "#F4E2DA", ring: "rgba(181,101,74,0.24)" },
  "#A8746B": { strong: "#86564E", tint: "#F1E6E2", ring: "rgba(168,116,107,0.24)" },
};

const fmt = (n) => "$" + n.toLocaleString("en-US");
const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ============================ TOP BAR ============================ */

function TopBar({ name, sessionTime }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo"><img src={(window.__resources && window.__resources.claireMark) || "assets/claire-mark.svg"} alt="Claire" /></div>
        <div className="logo-meta">
          <span className="logo-name">Claire</span>
          <span className="logo-sub">Private Member Services</span>
        </div>
      </div>
      <div className="topbar-center">
        <span className="who">{name}</span>
        <span className="verify-pill"><I.Check /> Identity Verified</span>
      </div>
      <div className="topbar-right">
        <div className="session">
          <div className="lbl">Session started</div>
          <div className="val">May 30, 2026 · {sessionTime}</div>
        </div>
      </div>
    </header>
  );
}

/* ============================ SESSION SWITCHER ============================ */

function SessionSwitcher({ sessions, activeId, onSelect }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const active = sessions.find((s) => s.id === activeId);

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="subnav">
      <div className="sw" ref={ref}>
        <button className="sw-btn" onClick={() => setOpen((o) => !o)}>
          <span className="sw-ava">{initials(active.name)}</span>
          <span className="sw-meta">
            <span className="sw-name">{active.name}</span>
            <span className="sw-plan">{active.plan}</span>
          </span>
          <span className={"sw-chev" + (open ? " up" : "")}><I.ChevDown /></span>
        </button>
        {open && (
          <div className="sw-pop">
            <div className="sw-pop-head">Recent conversations</div>
            {sessions.map((s) => (
              <button key={s.id} className={"sw-item" + (s.id === activeId ? " active" : "")}
                onClick={() => { onSelect(s.id); setOpen(false); }}>
                <span className="sw-ava list">{initials(s.name)}</span>
                <span className="sw-item-meta">
                  <span className="sw-item-top">
                    <span className="sw-item-name">{s.name}</span>
                    <span className="sw-item-time">{s.ago}</span>
                  </span>
                  <span className="sw-item-prev">{s.preview}</span>
                </span>
                {s.id === activeId && <span className="sw-active-dot" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="subnav-right">
        <span className="live-dot" />
        {sessions.length} active conversations
      </div>
    </div>
  );
}

/* ============================ MEMBER CARD ============================ */

function Meter({ label, paid, total, kind }) {
  const raw = total > 0 ? Math.round((paid / total) * 100) : 0;  // guard 0/0
  const pct = Math.min(100, raw);
  return (
    <div className="mc-meter">
      <div className="meter-head">
        <span className="ml">{label}</span>
        <span className="mv"><b>{fmt(paid)}</b> <span>/ {fmt(total)}</span></span>
      </div>
      <div className="track"><div className={"fill " + kind} style={{ width: pct + "%" }} /></div>
      <div className="meter-foot">{fmt(total - paid)} remaining · {pct}% met</div>
    </div>
  );
}

function MemberCard({ m }) {
  return (
    <section className="panel">
      <div className="mc-hero">
        <div className="mc-name">{m.name}</div>
        <div className="mc-sub">{m.id}</div>
        <div className="mc-planchip">
          <span className="pn">Medicare Advantage</span>
          <span className="pt">{m.coverage}</span>
        </div>
      </div>
      <div className="panel-scroll">
        <div className="mc-fields">
          <div className="mc-row"><span className="k">Date of birth</span><span className="v">{m.dob}</span></div>
          <div className="mc-row"><span className="k">Member ID</span><span className="v mono">{m.id}</span></div>
          <div className="mc-row"><span className="k">Coverage period</span><span className="v">{m.coverage}</span></div>
          {m.pcp && <div className="mc-row"><span className="k">Primary care physician</span><span className="v">{m.pcp}</span></div>}
        </div>
        <Meter label="Deductible" paid={m.deductiblePaid} total={m.deductibleTotal} kind="navy" />
        <Meter label="Out-of-pocket maximum" paid={m.oopPaid} total={m.oopTotal} kind="accent" />
      </div>
    </section>
  );
}

/* ============================ CONVERSATION ============================ */

function Message({ m }) {
  const out = m.role === "agent";
  return (
    <div className={"msg " + (out ? "out" : "in")}>
      <div className="bubble">{m.text}</div>
      <div className={"meta " + (out ? "out" : "")}>
        <span className="sender">{out ? "Claire" : "Member"}</span>
        <span>{m.time}</span>
      </div>
    </div>
  );
}

function Conversation({ messages, analyzing, onReplay, attestTime, hasContext }) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages && messages.length, analyzing]);

  return (
    <section className="panel conv">
      <div className="panel-head">
        <div className="panel-title"><span className="eyebrow">Live Session</span>Member Conversation</div>
        {onReplay && <button className="ghost-btn" onClick={onReplay}><I.Replay /> Replay</button>}
      </div>
      <div className="panel-scroll" ref={scrollRef}>
        <div className="thread">
          <div className="day-sep">Today · Secure messaging session</div>
          {(messages || []).map((m, i) => <Message key={i} m={m} />)}
          {analyzing && (
            <div className="analyzing">
              <I.Lock /> Analyzing in secure enclave
              <span className="dots"><i /><i /><i /></span>
            </div>
          )}
        </div>
      </div>
      <div className="composer">
        <input placeholder="Message the member…" readOnly />
        <button className="send" aria-label="Send"><I.Send /></button>
      </div>
      <div className="enc-note"><I.Lock /> Messages relayed over verified secure channel · end-to-end encrypted</div>
    </section>
  );
}

/* ============================ MEMBER RECORDS DOCK ============================ */

function RecordsDock({ open, onToggle, attestTime, hasContext, records }) {
  const refCount = 0;

  return (
    <section className={"rec-dock" + (open ? " open" : "")} style={{ height: open ? "clamp(284px, 35vh, 372px)" : "53px" }}>
      <div className="dock-head" onClick={onToggle}>
        <div className="dh-icon"><I.Database /></div>
        <div className="dh-title">Member Records</div>
        <div className="dh-tag">Read-only</div>
        {hasContext && refCount > 0 &&
          <div className="dh-hint"><b>{refCount}</b> record{refCount !== 1 ? "s" : ""} referenced in the last answer</div>}
        <div className="dh-spacer" />
        <div className="tee-badge">
          <div className="sh"><I.Shield /></div>
          <div className="tb-txt">
            <div className="tb-main">TEE Verified</div>
            <div className="tb-sub">{hasContext ? "attested " + attestTime : "hardware enclave"}</div>
          </div>
        </div>
        <div className="icon-btn" title={open ? "Collapse" : "Expand"} style={{ transform: open ? "none" : "rotate(180deg)" }}><I.ChevDown /></div>
      </div>

      <div className="dock-body">
        <div className="dock-col">
          <div className="rec-ghead"><I.Sparkle /> Eligibility</div>
          {records.eligibility.map((e, i) => (
            <div className="rec-bene" key={i}><span className="bn">{e.k}</span><span className="bv">{e.v}</span></div>
          ))}
          <div className="dock-attest">
            <div className="rec-ghead" style={{ marginBottom: 4 }}><I.Lock /> Privacy attestation</div>
            <div className="da-row"><span className="k">Enclave</span><span className="v">intel-tdx · us-east</span></div>
            <div className="da-row"><span className="k">Attested</span><span className="v">{hasContext ? attestTime : "awaiting query"}</span></div>
            <div className="da-row"><span className="k">Measurement</span><span className="v">0x9f2a…e7c1</span></div>
          </div>
        </div>

        <div className="dock-col">
          <div className="rec-ghead"><I.Doc /> Claims <span className="cnt">{records.claims.length}</span></div>
          {records.claims.map((c, i) => (
            <div className="rec-claim" key={i}>
              <div className="ct"><span className="cdate">{c.date}</span><span className={"cstatus " + c.cls}>{c.status}</span></div>
              <div className="cprov">{c.provider}</div>
              <div className="cdesc">{c.desc}</div>
              <div className="cgrid">
                <div className="cell"><div className="cl">Billed</div><div className="cv">{c.billed}</div></div>
                <div className="cell"><div className="cl">Plan paid</div><div className="cv">{c.planPaid}</div></div>
                <div className="cell"><div className="cl">Owed</div><div className="cv">{c.owed}</div></div>
              </div>
            </div>
          ))}
        </div>

        <div className="dock-col">
          <div className="rec-ghead"><I.Layers /> Benefits</div>
          {records.benefits.map((b, i) => (
            <div className="rec-bene" key={i}>
              <span className="bn">{b.name}</span>
              <span className="bv">{b.val}</span>
            </div>
          ))}
        </div>

        <div className="dock-col">
          <div className="rec-ghead"><I.Pill /> Medications <span className="cnt">{records.meds.length}</span></div>
          {records.meds.map((m, i) => (
            <div className="rec-med" key={i}>
              <div className="rx">Rx</div>
              <div className="mmid">
                <div className="mn">{m.name}</div>
                <div className="ms">{m.sub}</div>
              </div>
              <div className="mc-copay"><div className="cp">{m.copay}</div><div className="tier">{m.tier}</div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ APP ============================ */

window.App = function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [sessions, setSessions] = React.useState([]);
  const [sessionData, setSessionData] = React.useState({});
  const [activeId, setActiveId] = React.useState(null);
  const [visible, setVisible] = React.useState({});
  const [analyzing, setAnalyzing] = React.useState(false);
  const [attestTime, setAttestTime] = React.useState('—');
  const [recordsOpen, setRecordsOpen] = React.useState(true);
  const [sseError, setSseError] = React.useState(false);

  const activeIdRef = React.useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const formatDob = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatClaimDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  };

  const fmtD = (n) => '$' + (n ?? 0).toLocaleString('en-US');

  const claimStatusLabel = (c) => {
    if (c.isDenied) return 'Denied';
    if (c.status === 'pending') return 'Pending';
    if ((c.memberOwes ?? 0) === 0) return 'Covered';
    return 'Processed';
  };

  const claimStatusCls = (c) => {
    if (c.isDenied) return 'ded';
    if (c.status === 'pending') return 'proc';
    if ((c.memberOwes ?? 0) === 0) return 'ok';
    return 'proc';
  };

  const apiToSession = (data) => {
    const acc = data.accumulators;
    return {
      id: data.patientId,
      name: data.displayName,
      plan: data.planName || 'Claire Medicare Advantage Gold',
      planType: 'Medicare Advantage · PPO',
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      ago: '—',
      preview: 'No messages yet',
      member: {
        name: data.displayName,
        dob: formatDob(data.dateOfBirth),
        id: data.memberId,
        coverage: `Jan 1 – Dec 31, ${acc.planYear || new Date().getFullYear()}`,
        pcp: null,
        deductiblePaid: acc.deductiblePaid ?? 0,
        deductibleTotal: acc.deductibleTotal ?? 0,
        oopPaid: acc.oopPaid ?? 0,
        oopTotal: acc.oopTotal ?? 0,
      },
      records: {
        eligibility: [
          { k: 'Status', v: 'Active' },
          { k: 'Effective', v: '01/01/2026' },
          { k: 'Group', v: 'EVC-MA-2026' },
          { k: 'Network', v: 'In-network PPO' },
        ],
        claims: (data.recentClaims || []).slice(0, 6).map(c => ({
          date: formatClaimDate(c.serviceDate),
          provider: c.providerName,
          desc: c.claimType === 'pharmacy' ? 'Pharmacy claim' : 'Medical claim',
          billed: fmtD(c.billedAmount),
          planPaid: fmtD(c.planPaid),
          owed: fmtD(c.memberOwes),
          status: claimStatusLabel(c),
          cls: claimStatusCls(c),
        })),
        benefits: [
          { name: 'Annual deductible', val: `${fmtD(acc.deductiblePaid)} / ${fmtD(acc.deductibleTotal)}` },
          { name: 'Out-of-pocket max', val: `${fmtD(acc.oopPaid)} / ${fmtD(acc.oopTotal)}` },
          { name: 'PCP office visit', val: 'No copay' },
          { name: 'Specialist visit', val: '$55 copay' },
          { name: 'Urgent care', val: '$50 copay' },
          { name: 'Emergency room', val: '$130 copay' },
          { name: 'Physical therapy', val: '$35 copay' },
          { name: 'Lab services', val: 'No copay' },
          { name: 'Rx — Tier 1 preferred generic', val: 'No copay' },
          { name: 'Rx — Tier 2 generic', val: '$4 copay' },
          { name: 'Rx — Tier 3 preferred brand', val: '$45 copay' },
          { name: 'Part B giveback', val: '$55/mo reduction' },
          { name: 'Dental, vision, hearing', val: 'Included' },
          { name: 'Fitness & telehealth', val: 'Included' },
        ],
        meds: (data.medications || []).slice(0, 5).map(m => ({
          name: m.name,
          sub: (m.dosage && m.dosage.length <= 60) ? m.dosage : '30-day · in-network pharmacy',
          tier: 'Tier 1',
          copay: '$10',
        })),
      },
    };
  };

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSession = React.useCallback((patientId) => {
    fetch(`/api/patient/${patientId}`)
      .then(r => r.json())
      .then(data => {
        setSessionData(prev => ({ ...prev, [patientId]: apiToSession(data) }));
      })
      .catch(err => console.error('[claire] loadSession error:', err));
  }, []);

  // Mount: load patient list, auto-select first, open SSE
  React.useEffect(() => {
    fetch('/api/patients')
      .then(r => r.json())
      .then(list => {
        setSessions(list);
        if (list.length > 0) {
          const first = list[0].patientId;
          setActiveId(first);
          activeIdRef.current = first;
          loadSession(first);
        }
      })
      .catch(err => console.error('[claire] patients fetch error:', err));
  }, [loadSession]);

  // SSE
  React.useEffect(() => {
    const es = new EventSource('/events');

    es.onopen = () => setSseError(false);
    es.onerror = () => setSseError(true);

    es.addEventListener('sessions_updated', e => {
      try {
        const { sessions: list } = JSON.parse(e.data);
        setSessions(prev => {
          const existingIds = new Set(prev.map(s => s.patientId));
          const added = list
            .filter(s => !existingIds.has(s.patientId))
            .map(s => ({
              patientId: s.patientId,
              displayName: s.patientId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            }));
          return added.length ? [...prev, ...added] : prev;
        });
      } catch (err) { console.error('[claire] sessions_updated parse error:', err); }
    });

    es.addEventListener('session_started', e => {
      try {
        const { patientId } = JSON.parse(e.data);
        loadSession(patientId);
      } catch (err) { console.error('[claire] session_started parse error:', err); }
    });

    es.addEventListener('message_received', e => {
      try {
        const { patientId, message } = JSON.parse(e.data);
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        setVisible(prev => ({
          ...prev,
          [patientId]: [...(prev[patientId] || []), { role: 'member', text: message, time }],
        }));
        setSessionData(prev => {
          const s = prev[patientId];
          if (!s) return prev;
          return { ...prev, [patientId]: { ...s, preview: message.slice(0, 60) + (message.length > 60 ? '…' : '') } };
        });
      } catch (err) { console.error('[claire] message_received parse error:', err); }
    });

    es.addEventListener('claire_typing', e => {
      try {
        const { patientId } = JSON.parse(e.data);
        if (patientId === activeIdRef.current) setAnalyzing(true);
      } catch (err) { console.error('[claire] claire_typing parse error:', err); }
    });

    es.addEventListener('claire_response', e => {
      try {
        const { patientId, response, timestamp } = JSON.parse(e.data);
        setAnalyzing(false);
        const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        setVisible(prev => ({
          ...prev,
          [patientId]: [...(prev[patientId] || []), { role: 'agent', text: response, time }],
        }));
        if (patientId === activeIdRef.current) {
          setAttestTime(new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }));
        }
      } catch (err) { console.error('[claire] claire_response parse error:', err); }
    });

    es.addEventListener('claire_error', e => {
      try {
        const { patientId } = JSON.parse(e.data);
        if (patientId === activeIdRef.current) setAnalyzing(false);
      } catch (err) { console.error('[claire] claire_error parse error:', err); }
    });

    return () => es.close();
  }, [loadSession]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = (id) => {
    setActiveId(id);
    activeIdRef.current = id;
    setAnalyzing(false);
    setAttestTime('—');
    if (!sessionData[id]) loadSession(id);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const active = activeId ? sessionData[activeId] : null;

  if (!active || sessions.length === 0) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--ink-soft)', fontFamily: 'var(--font-sans)' }}>
        Loading sessions…
      </div>
    );
  }

  const currentVisible = visible[activeId] || [];

  const sessionList = sessions.map(s => {
    const d = sessionData[s.patientId];
    const msgs = visible[s.patientId] || [];
    const last = msgs[msgs.length - 1];
    return {
      id: s.patientId,
      name: d ? d.name : s.displayName,
      plan: d ? d.plan : 'EvanCare Medicare Advantage HMO',
      planType: d ? d.planType : 'Medicare Advantage · HMO',
      time: last ? last.time : '—',
      ago: '—',
      preview: last ? last.text.slice(0, 60) + (last.text.length > 60 ? '…' : '') : 'No messages yet',
    };
  });

  return (
    <div className="app" style={{ '--brand': t.brand, '--brand-strong': BRANDS[t.brand]?.strong, '--brand-tint': BRANDS[t.brand]?.tint, '--brand-ring': BRANDS[t.brand]?.ring, '--accent': t.accent, '--accent-strong': t.accent }}>
      <TopBar name={active.name} sessionTime={active.time} />
      {sseError && (
        <div style={{ background: '#7f1d1d', color: '#fecaca', fontSize: '12px', fontWeight: 600,
          padding: '6px 20px', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠</span> Live feed disconnected — reconnecting…
        </div>
      )}
      <SessionSwitcher sessions={sessionList} activeId={activeId} onSelect={handleSelect} />
      <div className="body">
        <div className="top-row">
          <MemberCard m={active.member} />
          <Conversation
            messages={currentVisible}
            analyzing={analyzing}
            attestTime={attestTime}
            hasContext={currentVisible.some(m => m.role === 'agent')}
            onReplay={null}
          />
        </div>
        <RecordsDock
          records={active.records}
          open={recordsOpen}
          onToggle={() => setRecordsOpen(o => !o)}
          hasContext={currentVisible.some(m => m.role === 'agent')}
          attestTime={attestTime}
        />
      </div>
      <TweaksPanel>
        <TweakSection label="Claire brand" />
        <TweakColor label="Brand" value={t.brand}
          options={["#C77B54", "#CE9457", "#B5654A", "#A8746B"]}
          onChange={(v) => setTweak("brand", v)} />
        <TweakSection label="Privacy accent" />
        <TweakColor label="Verified" value={t.accent}
          options={["#129684", "#1F9D6B", "#1E8FA8", "#3F8F4F"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Layout" />
        <TweakToggle label="Member records panel" value={recordsOpen} onChange={setRecordsOpen} />
      </TweaksPanel>
    </div>
  );
};
