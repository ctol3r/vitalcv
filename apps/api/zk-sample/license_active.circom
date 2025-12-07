pragma circom 2.0.0;

template CheckActive() {
    signal input status;
    signal output out;
    out <== status;
    status === 1;
}

component main = CheckActive();
