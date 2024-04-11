//Convenience Functions
{
  class Component {
    constructor(tag) {
      this.tag = tag;
    }
  }

  class LitComp extends Component {
    constructor(value) {
      super("Literal");
      this.value = value;
    }
  }

  class SequenceComp extends Component {
    //body is expected to be an array of Component objects
    constructor(body) {
      super("seq");
      this.stmts = body;
    }
  }

  class BlockComp extends Component {
    //body is expected to be an array of Component objects
    constructor(body) {
      super("blk");
      this.body = new SequenceComp(body);
    }
  }

  class CondComp extends Component {
    //pred is expected to be an expression
    //consBlk is expected to be a block
    //altBlk is expected to be a block
    constructor(pred, consBlk, altBlk) {
      super("cond");
      this.pred = pred;
      this.cons = consBlk.body;
      this.alt = altBlk.body;
    }
  }

  class CondBlockComp extends BlockComp {
    //This is a special component used to make implicit blocks for conditional components easier to implement
    //The VM does not use this Component
    //cond is expected to be a CondComp
    constructor(cond, stmt) {
      if (stmt) {
        super([stmt, cond]);
      } else {
        super([cond]);
      }
      this.cond = cond;
    }
  }

  class WhileComp extends Component {
    //pred is a expression, body is a block
    constructor (pred, body) {
      super("while")
      this.init = null;
      this.post = null;
      this.pred = pred;
      this.body = body;
    }
  }

  class BreakContComp extends Component {
    //type is either "break" or "continue"
    constructor (type) {
      super("break_cont");
      this.type = type;
    }
  }

  class NameComp extends Component {
    //symbol is a string representing the name
    constructor(sym) {
      super("nam");
      this.sym = sym;
    }
  }

  class VarComp extends Component {
    //sym is the string, expr is a component to be assigned, type is a string? Type is unused
    constructor(sym, expr, type) {
      super("var")
      this.sym = sym;
      this.expr = expr
      this.type = type
    }
  }
  
  class AppComp extends Component {
    //fun is a NameComp representing the function, args is an array of expression components e.g. Literals
    constructor (fun, args) {
      super("app")
      this.fun = fun;
      this.args = args;
    }
  }

  class ArrayCreateComp extends Component {
    //symbol is a string
    //size is a component
    //initial is an array of Components
    constructor (size, initial = []) {
      super("array_create")
      this.size = size
      this.initial = initial
    }
  }

  class SliceCreateComp extends Component {
    //symbol is a string
    //size is a component
    //initial is an array of Components
    constructor (array, low, high, max) {
      super("slice_create")
      this.array = array
      this.low = low
      this.high = high
      this.max = max
    }
  }

  class IndexGetComp extends Component {
    //symbol is a string
    //index is a component
    constructor (source, index) {
      super("index_get")
      this.source = source
      this.index = index
    }
  }

  class IndexSetComp extends Component {
    //symbol is a string
    //index is a Component
    //value is a Component
    constructor (source, index, value) {
      super("index_set")
      this.source = source
      this.index = index
      this.value = value
    }
  }

  function buildBinaryExpression(head, tail) {
    return tail.reduce(function(result, element) {
      return {
        tag: "binop",
        sym: element[1],
        first: result,
        second: element[3]
      };
    }, head);
  }

  function buildNestedIf(head, tail) {
    return tail.reduce(function(result, element) {
      //element is either a CondBlockComp or a BlockComp
      if (element.cond !== undefined) {
        result.cond.alt = element;
      } else {
        result.cond.alt = element.body;
      }
      return element;
    }, head);
  }
}

Program "global program"
    = __ blk:Block __ { return blk }
    / seq:Sequence {
        // Wrap sequence without block into block
        return { tag: "blk", body: seq }
    }

Sequence "list of statements"
    = __ head:Statement tail:(__ Statement)* __ {
        return {
          tag: "seq",
          stmts: [head].concat(tail.flatMap(values => values.filter(value => value !== null)))
        }
    }
    / __ head:Statement? __ {
        return { tag: "seq", stmts: head ? [head] : [] }
    }

Block "block" 
    = "{" seq:Sequence? "}" {
        return { tag: "blk", body: seq }
    }

Statement "statement"
    = Block
    / IfStatement
    / LoopStatement
    / LoopControlStatement
    / FunctionStatement
    / stmt:ReturnStatement EOS { return stmt }
    / stmt:ChannelSendStatement EOS { return stmt }
    / stmt:DeclareAssignStmt EOS { return stmt }
    / stmt:GoStatement EOS { return stmt }
    / stmt:Expression EOS { return stmt }
    // Allow empty statements
    / ";" __ { return null }

FunctionStatement "function statement" 
  = FunctionDeclaration 
  / MethodDeclaration

FunctionDeclaration "function declaration"
  = FunctionToken __ symbol:Identifier __ "(" __ params:ExpressionList __ ")" __ body: Block {
        return {
            tag: "fun",
            sym: symbol,
            prms: params.map(x => x.sym),
            body,
        }
    }

MethodDeclaration "method declaration"
  = FunctionToken __ "(" __ receiver:Identifier __ ")" __ symbol:Identifier __ "(" __ params:ExpressionList __ ")" __ body: Block {
        return {
            tag: "fun",
            sym: symbol,
            prms: [receiver].concat(params.map(x => x.sym)),
            body,
        }
    }

ReturnStatement "return statement"
  = ReturnToken __ expressions:Expression|1.., __ "," __| {
    return { tag : "ret", expressions }
  }

LoopStatement "loops"
  = WhileStatement

SimpleStatement "simple statement"
    = NameDeclaration
    / AssignmentStatement
    / Expression

WhileStatement "while statement" //while is not used in Golang
  = ForToken __
      init:SimpleStatement? __ SEMICOLON __ 
      pred:Expression? __ SEMICOLON __
      post:SimpleStatement? __
    body:Block 
    {
      let while_object;
      //If there is no predicate, the predicate is true (infinite loop)
      if (pred) {
        while_object = new WhileComp(pred, body);
      } else {
        const true_object = new LitComp(true);
        while_object = new WhileComp(true_object, body);
      }
      //the post statement is to be executed at the end of the loop, if it is executed
      if (post) {
        while_object.post = post; 
      }
      //the init is executed once before evaluating the condition
      if (init) {
        while_object.init = init
      }
      return while_object;
    }      
  / ForToken __ pred:Expression __ body:Block {
      return new WhileComp(pred, body);
    }
  / ForToken __  body:Block {
      return new WhileComp(new LitComp(true), body);
    }

LoopControlStatement 
  = BreakStatement
  / ContStatement

BreakStatement
  = BreakToken {return new BreakContComp("break")}

ContStatement
  = ContinueToken {return new BreakContComp("continue")}

IfStatement
  = main:IfBlock
    el:(__ ElseToken __ blk:( IfBlock / Block ){return blk})*
    {
      buildNestedIf(main, el);
      return main;
    }

IfBlock 
    = IfToken __ stmt:(stmt:SimpleStatement __ SEMICOLON __ {return stmt})? 
    __ pred:Expression __ cons:Block 
      {
        const cond = new CondComp(pred, cons, new BlockComp([]));
        if (stmt === undefined) {
          stmt = null;
        }
        return new CondBlockComp(cond, stmt);
      }

DeclareAssignStmt "declaration or assignment"
  = AssignmentStatement
  / NameDeclaration

NameDeclaration "name declaration"
    = ConstantDeclaration
    / VariableDeclaration
    / ShortDeclaration

ConstantDeclaration "const declaration"
    = ConstToken __ symbol:Identifier __ Assmt __ expression:Expression   {
        return {
            tag: "const",
            sym: symbol,
            expr: expression,
        }
    }

VariableDeclaration "var declaration"
    = VarToken __ symbol:Identifier __ type:Identifier? __ Assmt __ expression:Expression   {
        return {
            tag: "var",
            sym: symbol,
            expr: expression,
            type //type is unused
        }
    }
    / VarToken __ symbol:Identifier __ type:ArrayType {
        return new VarComp(symbol, 
                          new ArrayCreateComp(type.size), 
                          "array")
    }
    / VarToken __ symbol:Identifier __ type:BasicType {
      return {
          tag: "var",
          sym: symbol,
          expr: new LitComp(null),
          type //type is unused
      }
    }

ShortDeclaration "short variable declaration"
    = symbols:Identifier|1.., __ "," __| __ ShortAssmt __ expressions:Expression|1.., __ "," __| {
        return {
          tag: "variables",
          symbols,
          expressions,
        }
    }

AssignmentStatement 
  = VariableAssignment
  / ArrayAssignment

VariableAssignment "assignment"
  = symbol:Identifier __ Assmt __ exp:Expression { 
    return {
      tag : 'assmt',
      sym : symbol,
      expr : exp
    } 
  }

ArrayAssignment "array assignment"
  = symbol:NameExpression __ "[" __ index:Expression __ "]" __ 
    Assmt __ exp: Expression {
      return new IndexSetComp(symbol, index, exp)
    }

GoStatement "go statement"
    = "go" __ call:CallExpression {
        return {
            tag: "go",
            fun: call.fun,
            args: call.args,
        }
    }

ChannelSendStatement "channel send statement"
    = chan:UnaryExpression __ "<-" __ value:Expression {
        return {
            tag: "send",
            chan,
            value,
        }
    }

ChannelReadExpression "channel read expression"
    = "<-" __ chan:Expression {
        return {
            tag: "receive",
            chan,
        }
    }

Expression
    = BinaryExpression
    / UnaryExpression
    / ChannelReadExpression
    / CallExpression
    / PrimaryExpression 

MultiplicativeExpression
  = head:UnaryExpression 
    tail:(__ mul_op __ UnaryExpression)*
    { return buildBinaryExpression(head, tail); }
  / UnaryExpression

AdditiveExpression
  = head:MultiplicativeExpression
    tail:(__ add_op __ MultiplicativeExpression)*
    { return buildBinaryExpression(head, tail); }
  / MultiplicativeExpression

BinaryExpression
  = head:AdditiveExpression
    tail:(__ rel_op __ AdditiveExpression)*
    { return buildBinaryExpression(head, tail); }
  / AdditiveExpression

UnaryExpression
    = op:UnaryOperator __ e:UnaryExpression {
        return {
            tag: "unop",
            sym: op,
            expr: e
        }
    }
    / CallExpression

CallExpression
    = FunctionCall
    / MethodCall
    / SliceExpression
    / IndexAccessExpression
    / PrimaryExpression

FunctionCall
  = fn:PrimaryExpression __ args:Arguments {
        return { tag: "app", fun: fn, args: args }
    }

MethodCall
  = obj:NameExpression DOT fn:PrimaryExpression __ args:Arguments {
        return { tag: "app", fun: fn, args: [obj].concat(args) }
    }

SliceExpression "slice expression"
  = array:PrimaryExpression __ slice:Slice {
    return new SliceCreateComp(array, slice.low, slice.high, slice.max)
  }

IndexAccessExpression "index access"
  = p:PrimaryExpression __ i:Index {return new IndexGetComp(p, i)}

Slice "slice"
  = "[" __ low:Expression? __ COLON __ high:Expression? __ "]" {
    if (low === null) {
      low = new LitComp(null)
    }
    if (high === null) {
      high = new LitComp(null)
    }
    let max = new LitComp(null)
    return {low, high, max}
  }
  / "[" __ low:Expression? __ COLON __ high:Expression __ COLON __ max:Expression "]" {
    if (low) {
      return {low, high, max}
    } else {
      return {low : new LitComp(null), high, max}
    }
  }

Index "index access"
= "[" __ index:Expression __ "]" {
    return index
  }

PrimaryExpression
    = Literal
    / NameExpression
    / "(" __ expr:Expression __ ")" { return expr }

NameExpression
  = ident:Identifier { return { tag: "nam", sym: ident } }

Arguments
    = "(" __ exprs:ExpressionList __ ")" { return exprs }

ExpressionList
    = expr:Expression exprs:( __ "," __ exp:Expression {return exp})* {
        return [expr].concat(exprs).filter(x=>x!=null)
      }
    / expr:Expression? {return [expr].filter(x => x!=null)}


//In principle should be unicode letter and unicode digit
Identifier
    = !ReservedWord ident:$( letter ( letter / DecimalDigit )* ) {return ident}

//Added DecimalLiteral
Literal
  = ArrayLiteral
  / SliceLiteral
  / NullLiteral
  / BooleanLiteral
  / DecimalLiteral
  / StringLiteral

//Array
SliceLiteral "slice literal"
  = EmptyArrayType __ "{" __ exprs:ExpressionList __"}" {
    return new ArrayCreateComp(new LitComp(exprs.length), exprs)
  }

ArrayLiteral "array literal"
  = array:ArrayType __ "{" __ exprs:ExpressionList __"}" {
    return new ArrayCreateComp(array.size, exprs)
  }

//Strings
StringLiteral "string"
  = DQUO chars:(!LineTerminatorSequence char:[^"]{return char})* DQUO {
      return { tag: "Literal", value: chars.join("") };
    }
  / BQUO chars:([^`])* BQUO {
      return { tag: "Literal", value: chars.join("") };
    }
  / SQUO chars:([^']) SQUO {
      return { tag : "Literal", value : chars.charCodeAt(0)}
  }

NullLiteral
  = NullToken { return { tag: "Literal", value: null }; }

BooleanLiteral
  = TrueToken  { return { tag: "Literal", value: true  }; }
  / FalseToken { return { tag: "Literal", value: false }; }


DecimalLiteral
  = DecimalIntegerLiteral "." DecimalDigit* ExponentPart? {
      return { tag: "Literal", value: parseFloat(text()) };
    }
  / "." DecimalDigit+ ExponentPart? {
      return { tag: "Literal", value: parseFloat(text()) };
    }
  / DecimalIntegerLiteral ExponentPart? {
      return { tag: "Literal", value: parseFloat(text()) };
    }

DecimalIntegerLiteral
  = "0"
  / NonZeroDigit DecimalDigit*

DecimalDigit
  = [0-9]

NonZeroDigit
  = [1-9]

ExponentPart
  = ExponentIndicator SignedInteger

ExponentIndicator
  = "e"i

SignedInteger
  = [+-]? DecimalDigit+

HexDigit
  = [0-9a-f]i

letter            "letter"                      
  = [a-zA-ZáàâäãåçéèêëíìîïñóòôöõúùûüýÿæœÁÀÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸÆŒ]
  / "_"

//Simplified IdentifierPart 
IdentifierPart
  = IdentifierStart
  / letter
  / DecimalDigit

//Simplified IdentifierStart
IdentifierStart
  = "$"
  / "_"
  / "\\"      

// Tokens

BreakToken      = "break"      !IdentifierPart
ConstToken      = "const"      !IdentifierPart
ContinueToken   = "continue"   !IdentifierPart
ElseToken       = "else"       !IdentifierPart
FalseToken      = "false"      !IdentifierPart
ForToken        = "for"        !IdentifierPart
FunctionToken   = "func"       !IdentifierPart
IfToken         = "if"         !IdentifierPart
NullToken       = "null"       !IdentifierPart
ReturnToken     = "return"     !IdentifierPart
TrueToken       = "true"       !IdentifierPart
VarToken        = "var"        !IdentifierPart
WithToken       = "with"       !IdentifierPart

Tokens "tokens"
  = BreakToken
  / ConstToken
  / ContinueToken
  / ElseToken
  / FalseToken
  / ForToken
  / FunctionToken
  / IfToken
  / NullToken
  / ReturnToken
  / TrueToken
  / VarToken
  / WithToken

ReservedWord "reserved word"
  = Tokens

// Types
BasicType
  = Identifier

ArrayType
  //MUST be whitespace here, not __, this follows specification and woudln't work otherwise anyway.
  = "[" __ arraySize:Expression __ "]" type:(WhiteSpace* type:BasicType {return type})? {
    return {
      tag : 'array',
      size : arraySize,
    }
  }

EmptyArrayType
  = "[" __ "]" __ BasicType?

// Special Symbols
DOT
  = "."
SEMICOLON
  = ";"
COLON
  = ":"

//Quotes
DQUO              "double quote"                
  = "\u0022"        // ""
SQUO              "single quote"                
  = "\u0027"        // ''
BQUO              "back quote/grave accent"     
  = "\u0060"        // ``

LineTerminator
  = [\n\r\u2028\u2029]

LineTerminatorSequence "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029" 

__
  = (WhiteSpace / LineTerminatorSequence)* { return null }


WhiteSpace "whitespace"
  = "\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / Zs

// Separator, Space
Zs = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

// Either an explicit semicolon, a line terminator character, or the end of the file
EOS "end of statement"
  = WhiteSpace* ";" WhiteSpace*
  / WhiteSpace* (LineTerminatorSequence WhiteSpace*)+
  / EOF

EOF "end of file"
  = !.

//Binary Operators

mul_op          "multiplication operator"       
  = "*"
  / "/"
  / "%"

add_op          "addition operator"             
  = $("+" ![+=])
  / $("-" ![-=])

rel_op          "comparison operator"           
  = "=="           
  / "!="
  / "<="
  / ">="
  / "<"
  / ">"

Assmt
  = "=" !"="

ShortAssmt      
  = ":="

UnaryOperator
  = $("+" !"=")
  / $("-" !"=")
  / "!"
