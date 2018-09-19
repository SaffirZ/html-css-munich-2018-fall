// Some helpers

const filterByClass = className => event => event.classList.contains(className);
const initialState = {
    counter: 0,
};
const makeAction = (...fns) => (source) => pipe(source, ...fns);

// Actions
const events$ = pipe(
	fromEvent(document, 'click'),
	filter((ev) => ev.target.classList.contains('js-counter__action')),
	map((ev) => ev.target)
);

const addAction = makeAction(
	filter(filterByClass('js-counter__action-more')),
	map((e) => ({ type: 'ADD', value: 1 }))
);

const removeAction = makeAction(
	filter(filterByClass('js-counter__action-less')),
	map((e) => ({ type: 'REMOVE', value: -1 }))
);

const resetAction = makeAction(
    filter(filterByClass('js-counter__action-reset')),
    map((e) => ({ type: 'RESET', value: 0 }))
)

const allActions = merge(
    addAction(events$),
    removeAction(events$),
    resetAction(events$),
);

// state
const reducer = (state, action) => {
    if (action.type === 'RESET') {
        return initialState;
    }

    if (action.type === 'REMOVE' && state.counter === 0) {
        return initialState
    }

    return {
        counter: state.counter + action.value,
    };
}

const state$ = pipe(
    allActions,
    startWith({ type: 'INIT', value: 0}),
    scan(reducer, initialState),
);

// DOM
const $counter = document.querySelector('.js-counter__count');
const $actionLess = document.querySelector('.js-counter__action-less');
const $actionReset = document.querySelector('.js-counter__action-reset');
const updateValue = $element => state => ($element.innerText = state.counter, state);
const updateActionState = $element => state => ($element.parentElement.classList.toggle('counter__action--disabled', state.counter === 0), state)

pipe(
    state$,
    forEach(compose(
        updateActionState($actionLess),
        updateActionState($actionReset),
        updateValue($counter),
    ))
);
