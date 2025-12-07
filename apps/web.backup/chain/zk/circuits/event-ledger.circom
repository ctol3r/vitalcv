pragma circom 2.1.6;

/**
 * Event ledger inclusion circuit
 *
 * The circuit proves that a private leaf (event hash) belongs to a Merkle tree
 * with a public root using a MiMC-style hash that is efficient inside the BN254
 * scalar field. Sibling values and their positions are private witnesses, while
 * the root is exposed publicly so on-chain verifiers can compare it against the
 * anchored commitment.
 */

template Pow7() {
    signal input in;
    signal output out;

    signal in2;
    signal in4;
    signal in6;

    in2 <== in * in;
    in4 <== in2 * in2;
    in6 <== in4 * in2;
    out <== in6 * in;
}

template FieldHash() {
    signal input left;
    signal input right;
    signal output out;

    component powLeft = Pow7();
    component powRight = Pow7();

    powLeft.in <== left + 3;
    powRight.in <== right + 5;

    out <== powLeft.out + powRight.out + 1337;
}

template EventLedgerMerkle(depth) {
    signal input leaf;
    signal input root;
    signal input siblings[depth];
    signal input pathPositions[depth];

    signal output computedRoot;
    signal output pathCommitment;
    signal output isMember;

    signal current[depth + 1];
    signal digest[depth + 1];

    current[0] <== leaf;
    digest[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        signal bit;
        signal invBit;
        signal leftNode;
        signal rightNode;

        bit <== pathPositions[i];
        invBit <== 1 - bit;

        // Boolean constraint for direction bit
        bit * (bit - 1) === 0;

        leftNode <== invBit * current[i] + bit * siblings[i];
        rightNode <== bit * current[i] + invBit * siblings[i];

        component hasher = FieldHash();
        hasher.left <== leftNode;
        hasher.right <== rightNode;

        current[i + 1] <== hasher.out;
        digest[i + 1] <== digest[i] + siblings[i];
    }

    root === current[depth];

    computedRoot <== current[depth];
    pathCommitment <== digest[depth];
    isMember <== 1;
}

component main = EventLedgerMerkle(16);


