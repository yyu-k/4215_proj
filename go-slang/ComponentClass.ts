export class Component {
    tag : string
    constructor(tag : string) {
      this.tag = tag;
    }
  }

export class SequenceComp extends Component {
    stmts : Component[]
//body is expected to be an array of Component objects
    constructor(body : Component[]) {
        super("seq");
        this.stmts = body;
    }
}

export class BlockComp extends Component {
    body : SequenceComp
    //body is expected to be an array of Component objects
    constructor(body : Component[]) {
        super("blk");
        this.body = new SequenceComp(body);
    }
}


export class WhileComp extends Component {
    init : Component | null
    post : Component | null
    pred: Component
    body: BlockComp
    //pred is a expression, body is a block
    constructor (pred, body, init = null, post = null,) {
      super("while")
      this.init = init;
      this.post = post;
      this.pred = pred;
      this.body = body;
    }
  }