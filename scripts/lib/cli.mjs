export function parsePairedFlags(argv) {
  const tokens = argv.filter((token) => token !== "--");
  if (tokens.length % 2 !== 0) throw new Error(`missing value for ${tokens.at(-1)}`);

  const args = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag.startsWith("--")) throw new Error(`unexpected positional argument: ${flag}`);
    if (value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    if (args.has(flag)) throw new Error(`duplicate flag: ${flag}`);
    args.set(flag, value);
  }
  return args;
}
