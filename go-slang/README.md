# go-slang

## Grammar

### Completed

- Blocks
- Constant/variable declarations, reassignments
- Function calls
- `if`/`else` statements
- Expression statements
- `for` statements when they carry out the same function as `while`
- function declarations, returns

### Todo

- Other types of `for` statements 
- `go` statements
- Types
- Fix the compilation of the 'log' tag - should not work even in the original vm

## Todo

- Make constant declarations constant - this will require changing the compiler and VM
- Declaration of multiple variables in the same line;
- Immediate nested blocks? {{}}
- The definition of sequence is a bit odd in the grammar because Blocks and IfStatement have no EOS, but other statements do

## Implementation Notes

- Golang has no ternary operator: https://go.dev/doc/faq#Does_Go_have_a_ternary_form
- while loops are a type of for loops in Golang: https://go.dev/tour/flowcontrol/3
- String Literals are implemented on the basis that "" is the standard string, `` allows for new line characters, and '' is a single rune (the unicode code point of the character) https://yuminlee2.medium.com/golang-double-single-and-back-quotes-a347622e8081#cfa9
- Attempts to assign keytokens are a form of parse error
- +=, -=, ++, -- are not implemented
