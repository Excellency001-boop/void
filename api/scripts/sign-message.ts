import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.argv[2] as `0x${string}`;
const message = process.argv[3] as `0x${string}`;

const account = privateKeyToAccount(privateKey);
const sig = await account.signMessage({ message: { raw: message } });
console.log(sig);
