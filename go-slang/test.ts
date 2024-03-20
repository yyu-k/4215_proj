import { parser } from './parser/parser';
const { parse_compile_run } = require("./vm");

const program = `{
const i = 10;
5 + 2;
3 + 10;
}`;
const ast = parser.parse(program)
console.log(ast.body.stmts);
console.log(parse_compile_run(program, 50000));
