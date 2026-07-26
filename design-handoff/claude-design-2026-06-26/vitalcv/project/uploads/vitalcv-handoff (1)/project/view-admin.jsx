// view-admin.jsx — Wave 29 Admin Console surface
// 3-tab nav · Members / Audit log / Settings · with Billing pointer in sidebar.

function AdminConsoleView() {
  const [tab, setTab]                     = React.useState('members');
  const [org, setOrg]                     = React.useState(window.ADMIN_ORG);
  const [members, setMembers]             = React.useState(window.ADMIN_MEMBERS);
  const [auditRows, setAuditRows]         = React.useState(window.ADMIN_AUDIT_ROWS);
  const [billing]                         = React.useState(window.ADMIN_BILLING_POINTER);

  // Demo: current viewer is the owner.
  const currentUserRole = 'owner';

  /* ── handlers ─────────────────────────────────────────────────────────── */

  const appendAudit = (action, surface, outcome, detail) => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    setAuditRows(rows => [{
      id: 'aud_' + (Math.floor(Math.random() * 9000) + 1000),
      ts, actorId: 'm1', surface, action, outcome,
      detail, recordedBy: 'demo',
    }, ...rows]);
  };

  const handleInvite = ({ emails, role }) => {
    const newMembers = emails.map((e, i) => ({
      id: 'invited_' + Date.now() + '_' + i,
      name: e.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      email: e, role, status: 'invited', lastActiveTs: null,
    }));
    setMembers(prev => [...prev, ...newMembers]);
    emails.forEach(e => appendAudit('member-invited', '/admin/members', 'success', { invitedEmail: e, invitedRole: role }));
  };

  const handleChangeRole = (memberId, newRole) => {
    let prevRole = null;
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) { prevRole = m.role; return { ...m, role: newRole }; }
      return m;
    }));
    appendAudit('role-changed', '/admin/members', 'success', { memberId, from: prevRole, to: newRole });
  };

  const handleSuspend = (memberId) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'suspended' } : m));
    appendAudit('member-suspended', '/admin/members', 'success', { memberId });
  };

  const handleRemove = (memberId) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    appendAudit('member-removed', '/admin/members', 'success', { memberId });
  };

  const handleSaveSettings = (next) => {
    setOrg(next);
    appendAudit('org-settings-updated', '/admin/settings', 'success', { fieldsTouched: Object.keys(next) });
  };

  const handleManageBilling = () => {
    appendAudit('billing-portal-opened', '/admin/billing', 'success', { plan: billing.currentPlan });
    /* Wave 30 surface — link target. */
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Plans + Billing surface lives in Wave 30.');
    }
  };

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto',
      padding: '1.5rem',
      background: '#f8fafc', minHeight: '100vh',
      color: '#0f172a',
    }}>
      <header style={{ marginBottom: '1rem' }}>
        <div style={{ font: '400 0.6875rem/1.3 system-ui, sans-serif', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Wave 29 · org owner / admin surface
        </div>
        <h1 style={{ font: '600 1.75rem/1.15 system-ui, sans-serif', color: '#0f172a', marginTop: '0.25rem' }}>
          Admin Console
        </h1>
        <div style={{ font: '400 0.875rem/1.5 system-ui, sans-serif', color: '#475569', marginTop: '0.25rem' }}>
          {org.displayName} · {members.length} member{members.length === 1 ? '' : 's'} ·{' '}
          plan <strong>{billing.currentPlan}</strong> ({billing.seatsUsed}/{billing.seatsTotal} seats)
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(260px, 320px)', gap: '1.5rem', alignItems: 'start' }}>
        <main>
          <AdminTabNav tab={tab} onChange={setTab} />

          <div style={{ marginTop: '1.25rem' }}>
            {tab === 'members' && (
              <MembersList
                members={members}
                currentUserRole={currentUserRole}
                onInvite={handleInvite}
                onChangeRole={handleChangeRole}
                onSuspend={handleSuspend}
                onRemove={handleRemove}
              />
            )}
            {tab === 'audit' && (
              <AuditLogTab rows={auditRows} members={members} />
            )}
            {tab === 'settings' && (
              <OrgSettingsForm org={org} onSave={handleSaveSettings} />
            )}
          </div>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <BillingPointerCard billing={billing} onManage={handleManageBilling} />

          <div style={{
            border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
            padding: '1rem',
            font: '400 0.8125rem/1.5 system-ui, sans-serif', color: '#475569',
          }}>
            <div style={{ font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Out of scope here
            </div>
            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
              <li>SSO config — handled in a separate wave.</li>
              <li>Owner role transfer — separate flow.</li>
              <li>Real billing data — see Wave 30.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { AdminConsoleView });
