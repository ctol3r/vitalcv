// wave29-admin.jsx — Admin Console components
// Roles: owner | admin | reviewer | read-only
// Outcomes: success | denied | error
// Append-only audit log. recordedBy: 'demo' until persistence Phase 2.

/* ──────────────────────────────────────────────────────────────────────────
   Tab nav
   ────────────────────────────────────────────────────────────────────────── */

function AdminTabNav({ tab, onChange }) {
  const tabs = [
    { id: 'members',  label: 'Members'   },
    { id: 'audit',    label: 'Audit log' },
    { id: 'settings', label: 'Settings'  },
  ];
  return (
    <nav role="tablist" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--vt-surface-inset, #e2e8f0)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === tab}
          onClick={() => onChange(t.id)}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            background: 'transparent',
            borderBottom: t.id === tab ? '2px solid #4f46e5' : '2px solid transparent',
            color: t.id === tab ? '#0f172a' : '#475569',
            font: '500 0.875rem/1.4 system-ui, sans-serif',
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Members
   ────────────────────────────────────────────────────────────────────────── */

const ROLE_LABEL = {
  owner:       'Owner',
  admin:       'Admin',
  reviewer:    'Reviewer',
  'read-only': 'Read-only',
};

const STATUS_LABEL = {
  active:    'Active',
  invited:   'Invited (pending)',
  suspended: 'Suspended',
};

function RoleChip({ role }) {
  const palette = {
    owner:       { fg: '#7e22ce', bg: '#f3e8ff' },
    admin:       { fg: '#4f46e5', bg: '#eef2ff' },
    reviewer:    { fg: '#2563eb', bg: '#dbeafe' },
    'read-only': { fg: '#475569', bg: '#f1f5f9' },
  }[role] || { fg: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem',
      borderRadius: 999, font: '500 0.6875rem/1 system-ui, sans-serif',
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: palette.fg, background: palette.bg,
    }}>
      {ROLE_LABEL[role] || role}
    </span>
  );
}

function StatusChip({ status }) {
  const palette = {
    active:    { fg: '#15803d', bg: '#dcfce7' },
    invited:   { fg: '#b45309', bg: '#fef3c7' },
    suspended: { fg: '#b91c1c', bg: '#fee2e2' },
  }[status] || { fg: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem',
      borderRadius: 999, font: '500 0.6875rem/1 system-ui, sans-serif',
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: palette.fg, background: palette.bg,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function Avatar({ name }) {
  const initials = (name || '').split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 999,
      background: '#e2e8f0', color: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: '600 0.75rem/1 system-ui, sans-serif',
    }}>
      {initials || '—'}
    </div>
  );
}

function MemberRoleEditPopover({ member, onChange, onClose }) {
  const options = ['admin', 'reviewer', 'read-only']; // owner cannot be assigned via UI
  return (
    <div style={{
      position: 'absolute', right: 0, top: '110%',
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      boxShadow: '0 10px 25px rgba(0,0,0,0.08)', padding: '0.25rem',
      minWidth: 160, zIndex: 30,
    }} role="menu">
      {options.map(r => (
        <button
          key={r}
          onClick={() => { onChange(r); onClose(); }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '0.5rem 0.75rem', border: 'none', background: 'transparent',
            cursor: 'pointer', font: '400 0.8125rem/1.3 system-ui, sans-serif',
            color: '#0f172a', borderRadius: 6,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span>{ROLE_LABEL[r]}</span>
          {member.role === r && <span style={{ color: '#4f46e5' }}>•</span>}
        </button>
      ))}
    </div>
  );
}

function MemberSuspendConfirmModal({ member, action, onConfirm, onCancel }) {
  const verb = action === 'remove' ? 'Remove' : 'Suspend';
  const verbing = action === 'remove' ? 'remove' : 'suspend';
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', maxWidth: 480, width: 'calc(100% - 2rem)' }}>
        <div style={{ font: '600 1.125rem/1.3 system-ui, sans-serif', color: '#0f172a' }}>
          {verb} {member.name}?
        </div>
        <div style={{ font: '400 0.875rem/1.5 system-ui, sans-serif', color: '#475569', marginTop: '0.5rem' }}>
          {action === 'remove'
            ? 'This member loses all access immediately. They can be re-invited later.'
            : 'This member is signed out and cannot access the org until reactivated.'}
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            onClick={onCancel}
            style={{ padding: '0.5rem 0.875rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', font: '500 0.875rem/1 system-ui, sans-serif', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '0.5rem 0.875rem', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', font: '500 0.875rem/1 system-ui, sans-serif', cursor: 'pointer' }}
          >
            {verb} member
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, currentUserRole, onChangeRole, onSuspend, onRemove }) {
  const [roleOpen, setRoleOpen]    = React.useState(false);
  const [confirm, setConfirm]      = React.useState(null); // { action: 'suspend' | 'remove' }
  const canEdit = (currentUserRole === 'owner' || currentUserRole === 'admin') && member.role !== 'owner';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px minmax(160px, 1.4fr) minmax(200px, 1.6fr) auto auto auto auto',
      alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <Avatar name={member.name} />
      <div>
        <div style={{ font: '500 0.875rem/1.3 system-ui, sans-serif', color: '#0f172a' }}>{member.name}</div>
        <div style={{ font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#64748b' }}>
          last active {member.lastActiveTs || '—'}
        </div>
      </div>
      <div style={{ font: '400 0.8125rem/1.3 system-ui, sans-serif', color: '#475569' }}>
        {member.email}
      </div>
      <RoleChip role={member.role} />
      <StatusChip status={member.status} />

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setRoleOpen(o => !o)}
          disabled={!canEdit}
          style={{
            padding: '0.375rem 0.75rem', borderRadius: 6,
            border: '1px solid #cbd5e1', background: '#fff',
            color: canEdit ? '#0f172a' : '#94a3b8',
            font: '400 0.75rem/1 system-ui, sans-serif',
            cursor: canEdit ? 'pointer' : 'not-allowed',
          }}
        >
          Edit role
        </button>
        {roleOpen && canEdit && (
          <MemberRoleEditPopover
            member={member}
            onChange={r => onChangeRole(member.id, r)}
            onClose={() => setRoleOpen(false)}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <button
          onClick={() => setConfirm({ action: 'suspend' })}
          disabled={!canEdit || member.status === 'suspended'}
          style={{
            padding: '0.375rem 0.75rem', borderRadius: 6,
            border: '1px solid #fecaca', background: '#fff',
            color: canEdit && member.status !== 'suspended' ? '#b91c1c' : '#fca5a5',
            font: '400 0.75rem/1 system-ui, sans-serif',
            cursor: canEdit && member.status !== 'suspended' ? 'pointer' : 'not-allowed',
          }}
        >
          Suspend
        </button>
        <button
          onClick={() => setConfirm({ action: 'remove' })}
          disabled={!canEdit}
          style={{
            padding: '0.375rem 0.75rem', borderRadius: 6,
            border: '1px solid #cbd5e1', background: '#fff',
            color: canEdit ? '#0f172a' : '#94a3b8',
            font: '400 0.75rem/1 system-ui, sans-serif',
            cursor: canEdit ? 'pointer' : 'not-allowed',
          }}
        >
          Remove
        </button>
      </div>

      {confirm && (
        <MemberSuspendConfirmModal
          member={member}
          action={confirm.action}
          onConfirm={() => {
            if (confirm.action === 'suspend') onSuspend(member.id);
            else onRemove(member.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function InviteFormDrawer({ open, onClose, onSend }) {
  const [emails, setEmails]   = React.useState('');
  const [role, setRole]       = React.useState('reviewer');
  const [message, setMessage] = React.useState('');
  if (!open) return null;
  const emailList = emails.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }}>
      <div style={{ background: '#fff', width: 'min(440px, 100%)', height: '100%', overflow: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ font: '600 1.125rem/1.3 system-ui, sans-serif', color: '#0f172a' }}>Invite members</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>Close</button>
        </div>

        <label style={{ display: 'block', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Emails</label>
        <textarea
          value={emails}
          onChange={e => setEmails(e.target.value)}
          placeholder="alex@example.com, jordan@example.com"
          rows={3}
          style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif' }}
        />
        <div style={{ marginTop: '0.25rem', font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#64748b' }}>
          Comma- or whitespace-separated. {emailList.length} address{emailList.length === 1 ? '' : 'es'} parsed.
        </div>

        <label style={{ display: 'block', marginTop: '1rem', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif', background: '#fff' }}
        >
          {/* Owner intentionally excluded */}
          {(window.ADMIN_ROLES_INVITABLE || ['admin','reviewer','read-only']).map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <div style={{ marginTop: '0.25rem', font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#64748b' }}>
          Owner role is set at provisioning and cannot be assigned by invite.
        </div>

        <label style={{ display: 'block', marginTop: '1rem', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message (optional)</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          placeholder="A short note that goes with the invite email."
          style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif' }}
        />

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 0.875rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', font: '500 0.875rem/1 system-ui, sans-serif', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            disabled={emailList.length === 0}
            onClick={() => { onSend({ emails: emailList, role, message }); onClose(); }}
            style={{
              padding: '0.5rem 0.875rem', borderRadius: 8, border: 'none',
              background: emailList.length ? '#4f46e5' : '#a5b4fc',
              color: '#fff', font: '500 0.875rem/1 system-ui, sans-serif',
              cursor: emailList.length ? 'pointer' : 'not-allowed',
            }}
          >
            Send {emailList.length || 'N'} invite{emailList.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MembersList({ members, currentUserRole, onInvite, onChangeRole, onSuspend, onRemove }) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const isSparse = members.length <= 1;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ font: '600 1rem/1.3 system-ui, sans-serif', color: '#0f172a' }}>
            Members ({members.length})
          </div>
          <div style={{ font: '400 0.8125rem/1.3 system-ui, sans-serif', color: '#64748b' }}>
            Roles: owner · admin · reviewer · read-only.
          </div>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            padding: '0.5rem 0.875rem', borderRadius: 8, border: 'none',
            background: '#4f46e5', color: '#fff',
            font: '500 0.875rem/1 system-ui, sans-serif', cursor: 'pointer',
          }}
        >
          Invite member
        </button>
      </div>

      {isSparse ? (
        <div style={{
          padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: 12,
          textAlign: 'center', background: '#f8fafc',
        }}>
          <div style={{ font: '600 1rem/1.3 system-ui, sans-serif', color: '#0f172a' }}>
            You're the only member of this org
          </div>
          <div style={{ font: '400 0.875rem/1.5 system-ui, sans-serif', color: '#475569', marginTop: '0.5rem', maxWidth: 480, margin: '0.5rem auto 0' }}>
            Invite teammates to share review work. They start in <strong>{ROLE_LABEL.reviewer.toLowerCase()}</strong> or <strong>{ROLE_LABEL['read-only'].toLowerCase()}</strong> role by default.
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            style={{
              marginTop: '1rem', padding: '0.5rem 0.875rem', borderRadius: 8, border: 'none',
              background: '#4f46e5', color: '#fff',
              font: '500 0.875rem/1 system-ui, sans-serif', cursor: 'pointer',
            }}
          >
            Invite first teammate
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              currentUserRole={currentUserRole}
              onChangeRole={onChangeRole}
              onSuspend={onSuspend}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      <InviteFormDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSend={onInvite}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Audit log
   ────────────────────────────────────────────────────────────────────────── */

function OutcomeChip({ outcome }) {
  const palette = {
    success: { fg: '#15803d', bg: '#dcfce7' },
    denied:  { fg: '#b45309', bg: '#fef3c7' },
    error:   { fg: '#b91c1c', bg: '#fee2e2' },
  }[outcome] || { fg: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem',
      borderRadius: 999, font: '500 0.6875rem/1 system-ui, sans-serif',
      letterSpacing: '0.04em', textTransform: 'uppercase',
      color: palette.fg, background: palette.bg,
    }}>
      {outcome}
    </span>
  );
}

function AuditLogFilters({ filter, onChange, members }) {
  const surfaces = ['/admin/members', '/admin/settings', '/admin/audit', '/admin/billing', '/employer/console', '/file/credentialing'];
  const outcomes = ['success', 'denied', 'error'];
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
      <span style={{ font: '500 0.75rem/1.3 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
      <select
        value={filter.actor || ''}
        onChange={e => onChange({ ...filter, actor: e.target.value || null })}
        style={{ padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', font: '400 0.75rem/1.3 system-ui, sans-serif', background: '#fff' }}
      >
        <option value="">Any actor</option>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select
        value={filter.surface || ''}
        onChange={e => onChange({ ...filter, surface: e.target.value || null })}
        style={{ padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', font: '400 0.75rem/1.3 system-ui, sans-serif', background: '#fff' }}
      >
        <option value="">Any surface</option>
        {surfaces.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        value={filter.outcome || ''}
        onChange={e => onChange({ ...filter, outcome: e.target.value || null })}
        style={{ padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', font: '400 0.75rem/1.3 system-ui, sans-serif', background: '#fff' }}
      >
        <option value="">Any outcome</option>
        {outcomes.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {(filter.actor || filter.surface || filter.outcome) && (
        <button
          onClick={() => onChange({ actor: null, surface: null, outcome: null })}
          style={{ padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', font: '400 0.75rem/1.3 system-ui, sans-serif', cursor: 'pointer', color: '#0f172a' }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function AuditRowDetailPanel({ row, members }) {
  const actor = members.find(m => m.id === row.actorId);
  return (
    <div style={{
      background: '#f8fafc', borderTop: '1px solid #e2e8f0',
      padding: '0.75rem 1rem',
      font: '400 0.8125rem/1.5 system-ui, sans-serif', color: '#0f172a',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, max-content) 1fr', gap: '0.25rem 1rem' }}>
        <div style={{ color: '#64748b' }}>row.id</div>
        <div style={{ fontFamily: 'ui-monospace, monospace' }}>{row.id}</div>

        <div style={{ color: '#64748b' }}>recordedBy</div>
        <div style={{ fontFamily: 'ui-monospace, monospace' }}>{row.recordedBy}</div>

        <div style={{ color: '#64748b' }}>actor</div>
        <div>{actor ? `${actor.name} <${actor.email}>` : row.actorId}</div>

        <div style={{ color: '#64748b' }}>surface</div>
        <div style={{ fontFamily: 'ui-monospace, monospace' }}>{row.surface}</div>

        <div style={{ color: '#64748b' }}>action</div>
        <div style={{ fontFamily: 'ui-monospace, monospace' }}>{row.action}</div>

        <div style={{ color: '#64748b' }}>outcome</div>
        <div><OutcomeChip outcome={row.outcome} /></div>

        <div style={{ color: '#64748b' }}>timestamp</div>
        <div style={{ fontFamily: 'ui-monospace, monospace' }}>{row.ts}</div>

        <div style={{ color: '#64748b' }}>detail</div>
        <pre style={{
          margin: 0, padding: '0.5rem', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0',
          font: '400 0.75rem/1.4 ui-monospace, monospace', overflowX: 'auto',
        }}>{JSON.stringify(row.detail || {}, null, 2)}</pre>
      </div>
    </div>
  );
}

function AuditLogTab({ rows, members }) {
  const [filter, setFilter]   = React.useState({ actor: null, surface: null, outcome: null });
  const [openId, setOpenId]   = React.useState(null);

  const filtered = rows.filter(r =>
    (!filter.actor   || r.actorId === filter.actor) &&
    (!filter.surface || r.surface === filter.surface) &&
    (!filter.outcome || r.outcome === filter.outcome)
  );

  return (
    <div>
      <div style={{
        background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412',
        padding: '0.625rem 0.875rem', borderRadius: 8, marginBottom: '0.75rem',
        font: '400 0.8125rem/1.4 system-ui, sans-serif',
      }}>
        Demo data · Real audit trail begins after TRUST-PERSIST-1 Phase 2 ships. Until then,
        every row carries <code>recordedBy: 'demo'</code>. Audit log is append-only — rows
        cannot be edited or deleted from this surface.
      </div>

      <AuditLogFilters filter={filter} onChange={setFilter} members={members} />

      <div style={{ font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#64748b', marginBottom: '0.5rem' }}>
        Showing {filtered.length} of {rows.length} events
      </div>

      {filtered.length === 0 ? (
        <div style={{
          padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: 12,
          textAlign: 'center', background: '#f8fafc', color: '#475569',
          font: '400 0.875rem/1.5 system-ui, sans-serif',
        }}>
          No events match these filters. Audit events appear here when members take actions
          across the org.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map(row => {
            const actor = members.find(m => m.id === row.actorId);
            const open = openId === row.id;
            return (
              <div key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => setOpenId(open ? null : row.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'grid',
                    gridTemplateColumns: '160px minmax(120px, 1fr) minmax(160px, 1fr) minmax(180px, 1.2fr) 90px 24px',
                    alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                    border: 'none', background: open ? '#f8fafc' : '#fff',
                    cursor: 'pointer',
                    font: '400 0.8125rem/1.3 system-ui, sans-serif', color: '#0f172a',
                  }}
                >
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: '#64748b' }}>{row.ts}</span>
                  <span>{actor ? actor.name : row.actorId}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{row.surface}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{row.action}</span>
                  <OutcomeChip outcome={row.outcome} />
                  <span style={{ color: '#94a3b8' }}>{open ? '▾' : '▸'}</span>
                </button>
                {open && <AuditRowDetailPanel row={row} members={members} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Settings + Billing
   ────────────────────────────────────────────────────────────────────────── */

function OrgSettingsForm({ org, onSave }) {
  const [draft, setDraft]       = React.useState(org);
  const [saving, setSaving]     = React.useState(false);
  const [savedAt, setSavedAt]   = React.useState(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(org);

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      onSave(draft);
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString());
    }, 500);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <fieldset disabled={saving} style={{ border: 'none', padding: 0, margin: 0 }}>
        <label style={{ display: 'block', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Display name</label>
        <input
          value={draft.displayName}
          onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
          style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif' }}
        />

        <label style={{ display: 'block', marginTop: '1rem', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default wage (USD/hr) for ROI math</label>
        <input
          type="number"
          value={draft.defaultWageUsd}
          onChange={e => setDraft(d => ({ ...d, defaultWageUsd: Number(e.target.value) }))}
          style={{ width: 160, marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif' }}
        />
        <div style={{ marginTop: '0.25rem', font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#64748b' }}>
          Cross-references Wave 21 baseline + Wave 22 ROI calculations.
        </div>

        <label style={{ display: 'block', marginTop: '1rem', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>States served (comma-separated)</label>
        <input
          value={draft.baselinePolicy.statesServed.join(', ')}
          onChange={e => setDraft(d => ({ ...d, baselinePolicy: { ...d.baselinePolicy, statesServed: e.target.value.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean) } }))}
          style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif' }}
        />

        <label style={{ display: 'block', marginTop: '1rem', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Decision SLA target (days)</label>
        <input
          type="number"
          value={draft.baselinePolicy.decisionSlaDays}
          onChange={e => setDraft(d => ({ ...d, baselinePolicy: { ...d.baselinePolicy, decisionSlaDays: Number(e.target.value) } }))}
          style={{ width: 160, marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, font: '400 0.875rem/1.4 system-ui, sans-serif' }}
        />

        <label style={{ display: 'block', marginTop: '1rem', font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Logo</label>
        <div style={{
          marginTop: '0.25rem', padding: '0.75rem', border: '1px dashed #cbd5e1',
          borderRadius: 8, font: '400 0.8125rem/1.4 system-ui, sans-serif', color: '#64748b',
          background: '#f8fafc',
        }}>
          Logo upload — placeholder. Drop a PNG / SVG up to 1 MB.
        </div>
      </fieldset>

      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            padding: '0.5rem 0.875rem', borderRadius: 8, border: 'none',
            background: (dirty && !saving) ? '#4f46e5' : '#a5b4fc', color: '#fff',
            font: '500 0.875rem/1 system-ui, sans-serif',
            cursor: (dirty && !saving) ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {savedAt && !dirty && (
          <span style={{ font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#15803d' }}>
            Saved at {savedAt}
          </span>
        )}
      </div>
    </div>
  );
}

function BillingPointerCard({ billing, onManage }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
      padding: '1rem',
    }}>
      <div style={{ font: '500 0.75rem/1.4 system-ui, sans-serif', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Billing
      </div>
      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <div style={{ font: '600 1.25rem/1.2 system-ui, sans-serif', color: '#0f172a' }}>
          {billing.currentPlan}
        </div>
        <div style={{ font: '400 0.75rem/1.3 system-ui, sans-serif', color: '#64748b' }}>
          plan
        </div>
      </div>
      <div style={{ marginTop: '0.5rem', font: '400 0.8125rem/1.4 system-ui, sans-serif', color: '#475569' }}>
        Seats — <strong>{billing.seatsUsed}</strong> of {billing.seatsTotal} used
      </div>
      <div style={{ font: '400 0.8125rem/1.4 system-ui, sans-serif', color: '#475569' }}>
        Next invoice — <strong>{billing.nextInvoiceDate}</strong>
      </div>
      <button
        onClick={onManage}
        style={{
          marginTop: '0.75rem', width: '100%', padding: '0.5rem 0.875rem',
          borderRadius: 8, border: '1px solid #cbd5e1',
          background: '#fff', color: '#0f172a',
          font: '500 0.875rem/1 system-ui, sans-serif', cursor: 'pointer',
        }}
      >
        Manage billing →
      </button>
      <div style={{ marginTop: '0.5rem', font: '400 0.6875rem/1.3 system-ui, sans-serif', color: '#94a3b8' }}>
        Plans + Billing surface lives in Wave 30.
      </div>
    </div>
  );
}

Object.assign(window, {
  AdminTabNav, MembersList, MemberRow, MemberRoleEditPopover,
  MemberSuspendConfirmModal, InviteFormDrawer,
  AuditLogTab, AuditLogFilters, AuditRowDetailPanel,
  OutcomeChip, RoleChip, StatusChip,
  OrgSettingsForm, BillingPointerCard,
  ROLE_LABEL, STATUS_LABEL,
});
