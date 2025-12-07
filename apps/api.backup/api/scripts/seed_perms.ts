import { pool } from '../src/agent/db';

(async () => {
  const perms = ['view_invoices', 'manage_billing', 'manage_org', 'view_audit', 'manage_roles'];
  for (const p of perms) {
    await pool.query(
      'INSERT INTO "Permission"(key,description) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [p, p.replace('_', ' ')]
    );
  }
  await pool.query(
    "INSERT INTO \"RolePerm\"(role,perm_key) VALUES ('admin','manage_billing') ON CONFLICT DO NOTHING"
  );
  await pool.query(
    "INSERT INTO \"RolePerm\"(role,perm_key) VALUES ('admin','manage_org') ON CONFLICT DO NOTHING"
  );
  await pool.query(
    "INSERT INTO \"RolePerm\"(role,perm_key) VALUES ('viewer','view_invoices') ON CONFLICT DO NOTHING"
  );
  console.log('PERMS_OK');
  process.exit(0);
})();

