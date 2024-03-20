import { parser } from './parser/parser';
import { parse_compile_run } from './vm';

const program = `{
const i = 10;
5 + 2;
3 + 10;
display(1);
}`;
const ast = parser.parse(program)
console.log(JSON.stringify(ast.body.stmts, null, 2));
console.log(parse_compile_run(program, 50000));
