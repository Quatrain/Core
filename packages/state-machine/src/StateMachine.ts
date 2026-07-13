export type GuardFunction<TContext> = (context: TContext) => boolean;
export type ActionFunction<TContext> = (context: TContext) => void | Promise<void>;

/**
 * Base Abstract class representing state machines.
 * Encapsulates the current state and shared execution context.
 */
export abstract class BaseStateMachine<TState, TContext> {
   protected currentState: TState;
   protected context: TContext;

   /**
    * Initializes the state machine with an initial state and context.
    * 
    * @param initialState - The starting state of the machine.
    * @param context - The context payload.
    */
   constructor(initialState: TState, context: TContext) {
      this.currentState = initialState;
      this.context = context;
   }

   /**
    * Returns the active state of the machine.
    * 
    * @returns The current state.
    */
   public getState(): TState {
      return this.currentState;
   }

   /**
    * Returns the context bound to the machine.
    * 
    * @returns The active context object.
    */
   public getContext(): TContext {
      return this.context;
   }

   /**
    * Merges new properties into the state machine's execution context.
    * 
    * @param newContext - Partial context to merge.
    */
   public updateContext(newContext: Partial<TContext>): void {
      this.context = { ...this.context, ...newContext };
   }
}

export interface WorkflowTransition<TState, TEvent, TContext> {
   from: TState;
   event: TEvent;
   to: TState;
   guard?: GuardFunction<TContext>;
   action?: ActionFunction<TContext>;
}

/**
 * State machine managing linear forward-only workflows.
 * Handled via explicit events and transitions.
 */
export class WorkflowStateMachine<TState, TEvent, TContext> extends BaseStateMachine<TState, TContext> {
   protected transitions: WorkflowTransition<TState, TEvent, TContext>[] = [];
   protected history: TState[] = [];

   /**
    * Creates a workflow state machine.
    * 
    * @param initialState - Starting workflow state.
    * @param context - Context payload.
    */
   constructor(initialState: TState, context: TContext) {
      super(initialState, context);
      this.history.push(initialState);
   }

   /**
    * Registers a transition rule between two workflow states.
    * 
    * @param from - Origin state.
    * @param event - Event triggering the change.
    * @param to - Destination state.
    * @param guard - Optional guard function returning a boolean.
    * @param action - Optional action callback.
    * @returns The state machine instance for chaining.
    */
   public addTransition(
      from: TState,
      event: TEvent,
      to: TState,
      guard?: GuardFunction<TContext>,
      action?: ActionFunction<TContext>
   ): this {
      this.transitions.push({ from, event, to, guard, action });
      return this;
   }

   /**
    * Performs a transition to a new state if the event matches and the guard function passes.
    * 
    * @param event - The triggering event.
    * @returns A promise resolving to true if the transition succeeded, false otherwise.
    */
   public async transition(event: TEvent): Promise<boolean> {
      const match = this.transitions.find(
         (t) => t.from === this.currentState && t.event === event && (!t.guard || t.guard(this.context))
      );

      if (!match) {
         return false;
      }

      if (match.action) {
         await match.action(this.context);
      }

      this.currentState = match.to;
      this.history.push(match.to);
      return true;
   }

   /**
    * Returns the history trace of all states traversed.
    * 
    * @returns Array of state transitions.
    */
   public getHistory(): TState[] {
      return this.history;
   }
}

/**
 * Conformance classification state.
 */
export type ConformanceState = 'conforming' | 'degraded' | 'ko' | 'optimal' | 'satisfaisant' | 'mediocre' | 'danger';

export interface ConformanceRule<TContext> {
   state: ConformanceState;
   check: GuardFunction<TContext>;
}

/**
 * State machine managing dynamic object conformance evaluations.
 * Evaluates the context dynamically based on a series of prioritised rules.
 */
export class ConformanceStateMachine<TContext> extends BaseStateMachine<ConformanceState, TContext> {
   protected rules: ConformanceRule<TContext>[] = [];

   /**
    * Creates a conformance state machine.
    * 
    * @param initialState - Initial conformance classification.
    * @param context - Context payload.
    */
   constructor(initialState: ConformanceState, context: TContext) {
      super(initialState, context);
   }

   /**
    * Adds a rule to evaluate conformance status.
    * Rules are evaluated in priority order.
    * 
    * @param state - The target conformance state if check passes.
    * @param check - Predicate function evaluating the context.
    * @returns The state machine instance.
    */
   public addRule(state: ConformanceState, check: GuardFunction<TContext>): this {
      this.rules.push({ state, check });
      return this;
   }

   /**
    * Evaluates the current context and triggers transitions between conformance levels if necessary.
    * 
    * @returns True if a state change occurred, false otherwise.
    */
   public evaluate(): boolean {
      let targetState: ConformanceState = 'conforming';

      for (const rule of this.rules) {
         if (rule.check(this.context)) {
            targetState = rule.state;
            break;
         }
      }

      if (targetState !== this.currentState) {
         this.currentState = targetState;
         return true;
      }

      return false;
   }
}
