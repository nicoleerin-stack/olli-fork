import * as vegaLite from 'vega-lite';

const TYPE_ENUM = 'E';
const TYPE_RANGE_INC = 'R';
const TYPE_RANGE_RE = 'R-RE';
const TYPE_PRED_LT = 'E-LT';
const TYPE_PRED_LTE = 'E-LTE';
const TYPE_PRED_GT = 'E-GT';
const TYPE_PRED_GTE = 'E-GTE';
const TYPE_PRED_VALID = 'E-VALID';
const TYPE_PRED_ONE_OF = 'E-ONE';

const HIGHLIGHT_TEST = '!length(data("external_state_store")) || vlSelectionTest("external_state_store", datum)';
const SUPPORTED_MARK_TYPES = new Set(['rect', 'symbol', 'line', 'arc', 'shape']);

const predicateToTupleType = (predicate) => {
  if ('equal' in predicate) {
    return TYPE_ENUM;
  }
  if ('lt' in predicate) {
    return TYPE_PRED_LT;
  }
  if ('gt' in predicate) {
    return TYPE_PRED_GT;
  }
  if ('lte' in predicate) {
    return TYPE_PRED_LTE;
  }
  if ('gte' in predicate) {
    return TYPE_PRED_GTE;
  }
  if ('range' in predicate) {
    return predicate.inclusive ? TYPE_RANGE_INC : TYPE_RANGE_RE;
  }
  if ('oneOf' in predicate) {
    return TYPE_PRED_ONE_OF;
  }
  if ('valid' in predicate) {
    return TYPE_PRED_VALID;
  }
  return TYPE_ENUM;
};

const getPredicateValue = (predicate) => {
  const key = Object.keys(predicate).find((candidate) => candidate !== 'field');
  return key ? predicate[key] : undefined;
};

export const predicateToSelectionStore = (predicate) => {
  if (!predicate) {
    return null;
  }

  if ('and' in predicate) {
    const stores = predicate.and.map((entry) => predicateToSelectionStore(entry)).filter(Boolean);

    if (!stores.length) {
      return null;
    }

    return {
      unit: '',
      fields: stores.flatMap((store) => store.fields),
      values: stores.flatMap((store) => store.values),
    };
  }

  if ('or' in predicate || 'not' in predicate) {
    return null;
  }

  return {
    unit: '',
    fields: [
      {
        type: predicateToTupleType(predicate),
        field: predicate.field,
      },
    ],
    values: [getPredicateValue(predicate)],
  };
};

const withFillHighlight = (update) => {
  update.opacity = [{ test: HIGHLIGHT_TEST, value: 1 }, { value: 0.2 }];
  update.stroke = { value: '#d1d5db' };
  update.strokeWidth = { value: 1 };
};

const withPointHighlight = (update) => {
  update.opacity = [{ test: HIGHLIGHT_TEST, value: 0.9 }, { value: 0.15 }];
  update.size = [{ test: HIGHLIGHT_TEST, value: 110 }, { value: 70 }];
  update.strokeWidth = [{ test: HIGHLIGHT_TEST, value: 2 }, { value: 1 }];
};

const withLineHighlight = (update) => {
  update.opacity = [{ test: HIGHLIGHT_TEST, value: 1 }, { value: 0.18 }];
  update.strokeWidth = [{ test: HIGHLIGHT_TEST, value: 2 }, { value: 1.25 }];
};

const withArcHighlight = (update) => {
  update.opacity = [{ test: HIGHLIGHT_TEST, value: 1 }, { value: 0.2 }];
  update.stroke = { value: '#d1d5db' };
  update.strokeWidth = { value: 1 };
};

const withShapeHighlight = (update) => {
  update.opacity = [{ test: HIGHLIGHT_TEST, value: 1 }, { value: 0.25 }];
  update.stroke = { value: '#d1d5db' };
  update.strokeWidth = { value: 1 };
};

const applyMarkHighlight = (mark) => {
  if (!mark?.encode?.update) {
    return;
  }

  if (mark.type === 'symbol') {
    withPointHighlight(mark.encode.update);
    return;
  }

  if (mark.type === 'line') {
    withLineHighlight(mark.encode.update);
    return;
  }

  if (mark.type === 'arc') {
    withArcHighlight(mark.encode.update);
    return;
  }

  if (mark.type === 'shape') {
    withShapeHighlight(mark.encode.update);
    return;
  }

  if (mark.type === 'rect') {
    withFillHighlight(mark.encode.update);
  }
};

const walkMarks = (marks = []) => {
  marks.forEach((mark) => {
    applyMarkHighlight(mark);
    if (mark.marks) {
      walkMarks(mark.marks);
    }
  });
};

const collectUnsupportedMarks = (marks = [], unsupported = new Set()) => {
  marks.forEach((mark) => {
    if (!mark?.type) {
      return;
    }

    if (mark.type !== 'group' && !SUPPORTED_MARK_TYPES.has(mark.type)) {
      unsupported.add(mark.type);
    }

    if (mark.marks) {
      collectUnsupportedMarks(mark.marks, unsupported);
    }
  });

  return unsupported;
};

export const prepareTextNavHighlight = (baseSpec) => {
  const highlightedSpec = structuredClone(vegaLite.compile(baseSpec).spec);
  const unsupportedMarks = [...collectUnsupportedMarks(highlightedSpec.marks)];

  if (unsupportedMarks.length) {
    return {
      spec: highlightedSpec,
      supportsHighlighting: false,
      unsupportedMarks,
    };
  }

  highlightedSpec.data = [...(highlightedSpec.data || []), { name: 'external_state_store', values: [] }];
  walkMarks(highlightedSpec.marks);

  return {
    spec: highlightedSpec,
    supportsHighlighting: true,
    unsupportedMarks,
  };
};
