/**
 * For the libs implementation, mostly
 * @see https://github.com/callbag/
 */

function merge(...sources) {
	return (start, sink) => {
		if (start !== 0) return;
		const n = sources.length;
		const sourceTalkbacks = new Array(n);
		let startCount = 0;
		let endCount = 0;
		let ended = false;
		const talkback = (t, d) => {
			if (t === 2) ended = true;
			for (let i = 0; i < n; i++) sourceTalkbacks[i] && sourceTalkbacks[i](t, d);
		};
		for (let i = 0; i < n; i++) {
			if (ended) return;
			sources[i](0, (t, d) => {
				if (t === 0) {
					sourceTalkbacks[i] = d;
					if (++startCount === 1) sink(0, talkback);
				} else if (t === 2 && d) {
					ended = true;
					for (let j = 0; j < n; j++) {
						if (j !== i) sourceTalkbacks[j] && sourceTalkbacks[j](2);
					}
					sink(2, d);
				} else if (t === 2) {
					sourceTalkbacks[i] = void 0;
					if (++endCount === n) sink(2);
				} else sink(t, d);
			});
		}
	};
}

function pipe(...cbs) {
	let res = cbs[0];
	for (let i = 1, n = cbs.length; i < n; i++) res = cbs[i](res);
	return res;
}

const compose = (...fns) => fns.reduce((second, first) => (arg) => first(second(arg)));

const filter = (condition) => (source) => (start, sink) => {
	if (start !== 0) return;
	let talkback;
	source(0, (t, d) => {
		if (t === 0) {
			talkback = d;
			sink(t, d);
		} else if (t === 1) {
			if (condition(d)) sink(t, d);
			else talkback(1);
		} else sink(t, d);
	});
};

function scan(reducer, seed) {
	let hasAcc = arguments.length === 2;
	return (source) => (start, sink) => {
		if (start !== 0) return;
		let acc = seed;
		source(0, (t, d) => {
			if (t === 1) {
				acc = hasAcc ? reducer(acc, d) : ((hasAcc = true), d);
				sink(1, acc);
			} else sink(t, d);
		});
	};
}

const forEach = (operation) => (source) => {
	let talkback;
	source(0, (t, d) => {
		if (t === 0) talkback = d;
		if (t === 1) operation(d);
		if (t === 1 || t === 0) talkback(1);
	});
};

const fromEvent = (node, name) => (start, sink) => {
	if (start !== 0) return;
	const handler = (ev) => sink(1, ev);
	sink(0, (t) => {
		if (t === 2) node.removeEventListener(name, handler);
	});
	node.addEventListener(name, handler);
};

const logger = (v) => (console.log(v), v);

const map = (f) => (source) => (start, sink) => {
	if (start !== 0) return;
	source(0, (t, d) => {
		sink(t, t === 1 ? f(d) : d);
	});
};

const share = (source) => {
	let sinks = [];
	let sourceTalkback;

	return function shared(start, sink) {
		if (start !== 0) return;
		sinks.push(sink);

		const talkback = (t, d) => {
			if (t === 2) {
				const i = sinks.indexOf(sink);
				if (i > -1) sinks.splice(i, 1);
				if (!sinks.length) sourceTalkback(2);
			} else {
				sourceTalkback(t, d);
			}
		};

		if (sinks.length === 1) {
			source(0, (t, d) => {
				if (t === 0) {
					sourceTalkback = d;
					sink(0, talkback);
				} else for (let s of sinks.slice(0)) s(t, d);
				if (t === 2) sinks = [];
			});
			return;
		}

		sink(0, talkback);
	};
};

const startWith = (...xs) => (inputSource) => (start, outputSink) => {
	if (start !== 0) return;
	let disposed = false;
	let inputTalkback;
	let trackPull = false;
	let lastPull;

	outputSink(0, (ot, od) => {
		if (trackPull && ot === 1) {
			lastPull = [ 1, od ];
		}

		if (ot === 2) {
			disposed = true;
			xs.length = 0;
		}

		if (!inputTalkback) return;
		inputTalkback(ot, od);
	});

	while (xs.length !== 0) {
		if (xs.length === 1) {
			trackPull = true;
		}
		outputSink(1, xs.shift());
	}

	if (disposed) return;

	inputSource(0, (it, id) => {
		if (it === 0) {
			inputTalkback = id;
			trackPull = false;

			if (lastPull) {
				inputTalkback(...lastPull);
				lastPull = null;
			}
			return;
		}
		outputSink(it, id);
	});
};

const subscribe = (listener = {}) => (source) => {
	if (typeof listener === 'function') {
		listener = { next: listener };
	}

	let { next, error, complete } = listener;
	let talkback;

	source(0, (t, d) => {
		if (t === 0) {
			talkback = d;
		}
		if (t === 1 && next) next(d);
		if (t === 1 || t === 0) talkback(1); // Pull
		if (t === 2 && !d && complete) complete();
		if (t === 2 && !!d && error) error(d);
	});

	const dispose = () => {
		if (talkback) talkback(2);
	};

	return dispose;
};
