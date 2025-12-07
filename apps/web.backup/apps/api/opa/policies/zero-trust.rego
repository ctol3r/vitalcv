package vital.zero_trust

default allow = false
default deny = false

allow {
	not deny
}

deny {
	violation[msg]
}

violation[msg] {
	input.request.org_id != input.resource.org_id
	msg := sprintf("cross-tenant access blocked: %v → %v", [input.request.org_id, input.resource.org_id])
}

violation[msg] {
	required_role := input.resource.role
	not user_has_role(required_role)
	msg := sprintf("role %v required for %v", [required_role, input.resource.path])
}

violation["issuer scope blocked"] {
	input.kill_switch.active
	input.kill_switch.scopes[_] == "issuance"
	input.resource.capability == "issue"
}

violation["verifier scope blocked"] {
	input.kill_switch.active
	input.kill_switch.scopes[_] == "verification"
	input.resource.capability == "verify"
}

user_has_role(role) {
	input.request.roles[_] == role
}

allow_subject_scope {
	input.request.subject_id == input.resource.subject_id
}

allow_subject_scope {
	user_has_role("internal_admin")
}

