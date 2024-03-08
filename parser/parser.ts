import * as peg from "pegjs";
import * as fs from 'node:fs';
import * as path from 'path';

//grammer modified from https://github.com/hachi8833/golang_spec_peg_pigen
const grammar = fs.readFileSync(path.resolve(__dirname, "./grammar.peg")).toString();
export const parser = peg.generate(grammar);