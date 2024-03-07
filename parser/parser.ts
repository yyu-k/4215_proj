import * as peg from "pegjs";
import * as fs from 'node:fs';

//grammer modified from https://github.com/hachi8833/golang_spec_peg_pigen
const grammar = fs.readFileSync('./grammar.peg').toString();
const parser = peg.generate(grammar);

console.log(parser.parse(`10+3;`));