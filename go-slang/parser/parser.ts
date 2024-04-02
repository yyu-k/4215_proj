import * as peg from "peggy";
import * as fs from 'node:fs';
import * as path from 'path';


const grammar = fs.readFileSync(path.resolve(__dirname, "./grammar.peg"), "utf-8");
export const parser = peg.generate(grammar);
