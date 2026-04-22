import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';
import html from 'solid-js/html';
import * as vega from 'vega';
import { olli } from 'olli';
import { VegaLiteAdapter } from 'olli-adapters';
import { vegaLiteExamples } from './example-data';
import { predicateToSelectionStore, prepareTextNavHighlight } from './vegaLiteTextNavHighlight';
import './styles.css';

function App() {
  const [selectedId, setSelectedId] = createSignal(vegaLiteExamples[0]?.id ?? '');
  const [status, setStatus] = createSignal('Rendering example...');
  const [errorMessage, setErrorMessage] = createSignal('');
  let chartRef;
  let olliRef;

  const currentExample = createMemo(() => {
    return vegaLiteExamples.find((example) => example.id === selectedId()) ?? vegaLiteExamples[0];
  });

  const currentLabel = createMemo(() => {
    const example = currentExample();
    return example?.developmentOnly ? `${example?.title} / lab build` : example?.title ?? 'Example';
  });

  createEffect(() => {
    const example = currentExample();

    if (!example || !chartRef || !olliRef) {
      return;
    }

    let disposed = false;
    let view;

    chartRef.innerHTML = '';
    olliRef.innerHTML = '';
    setErrorMessage('');
    setStatus(`Rendering ${example.title}...`);

    const renderExample = async () => {
      try {
        const highlightState = prepareTextNavHighlight(example.spec);
        const runtime = vega.parse(highlightState.spec);

        view = new vega.View(runtime)
          .logLevel(vega.Warn)
          .initialize(chartRef)
          .renderer('svg')
          .hover();

        await view.runAsync();

        const olliSpec = await VegaLiteAdapter(example.spec);

        if (disposed) {
          return;
        }

        if (highlightState.supportsHighlighting) {
          const updateFocus = (predicate) => {
            const store = predicateToSelectionStore(predicate);
            view.data('external_state_store', store ? [store] : []).run();
          };

          olliRef.appendChild(
            olli(olliSpec, {
              onTextNavPred: (predicate) => {
                updateFocus(predicate);
              },
            })
          );
        } else {
          olliRef.appendChild(olli(olliSpec));
        }

        setStatus(
          highlightState.supportsHighlighting
            ? `Showing ${example.title} with linked text navigation`
            : `Showing ${example.title} with standard Olli navigation`
        );
      } catch (error) {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(message);
        setStatus(`Could not render ${example.title}`);
      }
    };

    renderExample();

    onCleanup(() => {
      disposed = true;

      if (view) {
        view.finalize();
      }

      if (chartRef) {
        chartRef.innerHTML = '';
      }

      if (olliRef) {
        olliRef.innerHTML = '';
      }
    });
  });

  const handleSelectChange = (event) => {
    setSelectedId(event.currentTarget.value);
  };

  return html`
    <main class="dashboard-shell">
      <section class="hero-card">
        <div class="hero-copy-block">
          <h1>Olli Demo Dashboard</h1>
          <p class="hero-copy">
            A focused interface for reviewing Vega-Lite examples alongside their Olli output, making it easier to
            compare chart structure, navigation behavior, and accessible interpretation in one place.
          </p>
        </div>
        <div class="control-card">
          <p class="field-label">Current Example</p>
          <p class="selected-title">${() => currentLabel()}</p>
          <label class="field-label" for="example-select">Browse Examples</label>
          <select id="example-select" class="select-input" value=${selectedId()} onChange=${handleSelectChange}>
            ${vegaLiteExamples.map((example) => html`
              <option value=${example.id}>
                ${example.title}${example.developmentOnly ? ' (development)' : ''}
              </option>
            `)}
          </select>
          <p class="status-line">${status()}</p>
        </div>
      </section>

      <section class="summary-grid">
        <article class="summary-card">
          <span class="summary-label">Examples Available</span>
          <strong>${vegaLiteExamples.length} views</strong>
        </article>
        <article class="summary-card">
          <span class="summary-label">Example Source</span>
          <strong>${() => currentExample()?.codePath ?? 'n/a'}</strong>
        </article>
        <article class="summary-card">
          <span class="summary-label">Gallery Route</span>
          <strong>${() => currentExample()?.galleryUrl ?? 'n/a'}</strong>
        </article>
      </section>

      <section class="panel-grid keyboard-grid">
        <article class="panel keyboard-panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Olli Controls</p>
              <h2>Navigation Shortcuts</h2>
            </div>
          </div>
          <p class="keyboard-intro">Press <kbd>o</kbd> to move focus into the current Olli tree, then continue with the standard Olli keyboard controls.</p>
          <div class="shortcut-grid">
            <p><kbd>Up</kbd> / <kbd>Down</kbd> move up or down a level in the tree.</p>
            <p><kbd>Left</kbd> / <kbd>Right</kbd> move between items in the current level.</p>
            <p><kbd>Home</kbd> / <kbd>End</kbd> jump to the first or last item in a level.</p>
            <p><kbd>x</kbd>, <kbd>y</kbd>, and <kbd>l</kbd> jump to the x-axis, y-axis, or legend.</p>
            <p><kbd>o</kbd> returns to the top level of the current Olli tree.</p>
            <p><kbd>Shift</kbd> + <kbd>Left</kbd> / <kbd>Right</kbd> move across facets or layers.</p>
            <p><kbd>t</kbd> opens the table view for the current location.</p>
            <p><kbd>f</kbd> opens the filter menu to add or remove data filters.</p>
          </div>
        </article>
      </section>

      <section class="panel-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Chart View</p>
              <h2>${() => currentLabel()}</h2>
            </div>
          </div>
          <div class="viz-surface" ref=${(element) => (chartRef = element)}></div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Assistive Structure</p>
              <h2>Olli Tree</h2>
            </div>
          </div>
          <div class="tree-surface" ref=${(element) => (olliRef = element)}></div>
        </article>
      </section>

      <section class="panel-grid secondary">
        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Specification</p>
              <h2>Vega-Lite Spec</h2>
            </div>
          </div>
          <p class="panel-note">The extracted chart specification used to render the active example.</p>
          <pre class="code-block"><code>${() => currentExample()?.specSource ?? ''}</code></pre>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-kicker">Source</p>
              <h2>Example HTML</h2>
            </div>
          </div>
          <p class="panel-note">The original repo example file that feeds this dashboard view.</p>
          <pre class="code-block"><code>${() => currentExample()?.htmlSource ?? ''}</code></pre>
        </article>
      </section>

      ${() =>
        errorMessage()
          ? html`
              <section class="error-banner" role="alert">
                <strong>Render error:</strong> ${errorMessage()}
              </section>
            `
          : ''}
    </main>
  `;
}

render(App, document.getElementById('app'));
