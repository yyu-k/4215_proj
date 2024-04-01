# go-slang

## Grammar

### Completed

- Blocks
- Constant/variable declarations
- Function calls
- `if`/`else` statements
- Expression statements

### Todo

- Function declarations
- `while` statements
- go statements
- Types
- Remove all references to "lit" in the vm - changed to Literal
- Remove extra console.log


## Todo

- Make constant declarations constant - this will require changing the compiler and VM
- Declaration of multiple variables in the same line;
- Immediate nested blocks? {{}}
- The definition of sequence is a bit odd in the grammar because Blocks and IfStatement have no EOS, but other statements do
