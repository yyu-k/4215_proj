import { parser } from './parser/parser';
import { parse_compile_run } from './vm';

const program = `{
i := 10;
if (true) {
    5;
} 
7 + 2;
(5 - 4) + 2;
3 + 10;
display( 100 - 5 );
func echo(i) {
  display( i + 100 );
}
14;
go echo(i);
}`;
const ast = parser.parse(program)
console.log(JSON.stringify(ast.body.stmts, null, 2));
console.log(parse_compile_run(program, 50000));
