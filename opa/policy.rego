package chai.authz

default allow = false

allow {
    input.method == "POST"
}
