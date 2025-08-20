const { promisify } = require('util');
const { exec: _exec } = require('child_process');
const fs = require('fs/promises');
const exec = promisify(_exec);

async function run() {
  await fs.mkdir('build', { recursive: true });
  await exec('circom license_active.circom --r1cs --wasm --sym -o build');

  // Phase 1: Powers of Tau
  await exec('npx snarkjs powersoftau new bn128 8 pot8_0000.ptau -v');
  await exec('npx snarkjs powersoftau contribute pot8_0000.ptau pot8_0001.ptau --name="First" -v -e="random"');
  await exec('npx snarkjs powersoftau prepare phase2 pot8_0001.ptau pot8_final.ptau -v');

  // Phase 2: Circuit-specific setup
  await exec('npx snarkjs groth16 setup build/license_active.r1cs pot8_final.ptau circuit_0000.zkey');
  await exec('npx snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="Contributor" -v -e="random"');
  await exec('npx snarkjs zkey export verificationkey circuit_final.zkey verification_key.json');

  // Witness generation
  await fs.writeFile('input.json', JSON.stringify({ status: 1 }));
  await exec('npx snarkjs wtns calculate build/license_active_js/license_active.wasm input.json witness.wtns');

  // Proof generation
  await exec('npx snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json');

  // Verification
  await exec('npx snarkjs groth16 verify verification_key.json public.json proof.json');

  console.log('Proof verified successfully');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
