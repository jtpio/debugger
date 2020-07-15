// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JupyterFrontEnd } from '@jupyterlab/application';

import { CodeEditor, IEditorServices } from '@jupyterlab/codeeditor';

import { IConsoleTracker } from '@jupyterlab/console';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import { INotebookTracker } from '@jupyterlab/notebook';

import { chain, each, IIterator } from '@lumino/algorithm';

import { IDebugger, IDebuggerReadOnlyEditorTracker } from './tokens';

/**
 * A class to find instances of code editors across notebook, console and files widgets
 */
export class EditorFinder implements IDebugger.IEditorFinder {
  /**
   * Instantiate a new EditorFinder.
   *
   * @param options The instantiation options for a EditorFinder.
   */
  constructor(options: EditorFinder.IOptions) {
    this._config = options.config;
    this._shell = options.shell;
    this._notebookTracker = options.notebookTracker;
    this._consoleTracker = options.consoleTracker;
    this._editorTracker = options.editorTracker;
    this._readOnlyEditorTracker = options.readOnlyEditorTracker;
  }

  /**
   * Returns an iterator of editors for a source matching the current debug
   * session by iterating through all the widgets in each of the supported
   * debugger types (i.e., consoles, files, notebooks).
   *
   * @param params - The editor search parameters.
   */
  find(params: IDebugger.IEditorFinder.Params): IIterator<CodeEditor.IEditor> {
    return chain(
      this._findInConsoles(params),
      this._findInEditors(params),
      this._findInNotebooks(params),
      this._findInReadOnlyEditors(params)
    );
  }

  /**
   * Find relevant editors matching the search params in the notebook tracker.
   *
   * @param params - The editor search parameters.
   */
  private _findInNotebooks(
    params: IDebugger.IEditorFinder.Params
  ): CodeEditor.IEditor[] {
    if (!this._notebookTracker) {
      return [];
    }
    const { focus, kernel, path, source } = params;

    const editors: CodeEditor.IEditor[] = [];
    this._notebookTracker.forEach(notebookPanel => {
      const sessionContext = notebookPanel.sessionContext;

      if (path !== sessionContext.path) {
        return;
      }

      const notebook = notebookPanel.content;
      if (focus) {
        notebook.mode = 'command';
      }

      const cells = notebookPanel.content.widgets;
      cells.forEach((cell, i) => {
        // check the event is for the correct cell
        const code = cell.model.value.text;
        const cellId = this._config.getCodeId(code, kernel);
        if (source !== cellId) {
          return;
        }
        if (focus) {
          notebook.activeCellIndex = i;
          const { node } = notebook.activeCell.inputArea;
          const rect = node.getBoundingClientRect();
          notebook.scrollToPosition(rect.bottom, 45);
          this._shell.activateById(notebookPanel.id);
        }
        editors.push(cell.editor);
      });
    });
    return editors;
  }

  /**
   * Find relevant editors matching the search params in the console tracker.
   *
   * @param params - The editor search parameters.
   */
  private _findInConsoles(
    params: IDebugger.IEditorFinder.Params
  ): CodeEditor.IEditor[] {
    if (!this._consoleTracker) {
      return [];
    }
    const { focus, kernel, path, source } = params;

    const editors: CodeEditor.IEditor[] = [];
    this._consoleTracker.forEach(consoleWidget => {
      const sessionContext = consoleWidget.sessionContext;

      if (path !== sessionContext.path) {
        return;
      }

      const cells = consoleWidget.console.cells;
      each(cells, cell => {
        const code = cell.model.value.text;
        const codeId = this._config.getCodeId(code, kernel);
        if (source !== codeId) {
          return;
        }
        editors.push(cell.editor);
        if (focus) {
          this._shell.activateById(consoleWidget.id);
        }
      });
    });
    return editors;
  }

  /**
   * Find relevant editors matching the search params in the editor tracker.
   *
   * @param params - The editor search parameters.
   */
  private _findInEditors(
    params: IDebugger.IEditorFinder.Params
  ): CodeEditor.IEditor[] {
    if (!this._editorTracker) {
      return;
    }
    const { focus, kernel, path, source } = params;

    const editors: CodeEditor.IEditor[] = [];
    this._editorTracker.forEach(doc => {
      const fileEditor = doc.content;
      if (path !== fileEditor.context.path) {
        return;
      }

      const editor = fileEditor.editor;
      if (!editor) {
        return;
      }

      const code = editor.model.value.text;
      const codeId = this._config.getCodeId(code, kernel);
      if (source !== codeId) {
        return;
      }
      editors.push(editor);
      if (focus) {
        this._shell.activateById(doc.id);
      }
    });
    return editors;
  }

  /**
   * Find relevant editors matching the search params in the read-only tracker.
   *
   * @param params - The editor search parameters.
   */
  private _findInReadOnlyEditors(
    params: IDebugger.IEditorFinder.Params
  ): CodeEditor.IEditor[] {
    if (!this._readOnlyEditorTracker) {
      return;
    }

    const { focus, kernel, source } = params;

    const editors: CodeEditor.IEditor[] = [];
    this._readOnlyEditorTracker.forEach(widget => {
      const editor = widget.content?.editor;
      if (!editor) {
        return;
      }

      const code = editor.model.value.text;
      const codeId = this._config.getCodeId(code, kernel);
      if (widget.title.caption !== source && source !== codeId) {
        return;
      }
      editors.push(editor);
      if (focus) {
        this._shell.activateById(widget.id);
      }
    });
    return editors;
  }

  private _shell: JupyterFrontEnd.IShell;
  private _config: IDebugger.IConfig;
  private _notebookTracker: INotebookTracker | null;
  private _consoleTracker: IConsoleTracker | null;
  private _editorTracker: IEditorTracker | null;
  private _readOnlyEditorTracker: IDebuggerReadOnlyEditorTracker;
}
/**
 * A namespace for editor finder statics.
 */
export namespace EditorFinder {
  /**
   * The options used to initialize a EditorFinder object.
   */
  export interface IOptions {
    /**
     * The instance of configuration with hash method.
     */
    config: IDebugger.IConfig;

    /**
     * An optional editor finder for consoles.
     */
    consoleTracker?: IConsoleTracker;

    /**
     * The editor services.
     */
    editorServices: IEditorServices;

    /**
     * An optional tracker for file editors.
     */
    editorTracker?: IEditorTracker;

    /**
     * An optional tracker for read-only file editors.
     */
    readOnlyEditorTracker?: IDebuggerReadOnlyEditorTracker;

    /**
     * An optional editor finder for notebooks.
     */
    notebookTracker?: INotebookTracker;

    /**
     * The application shell.
     */
    shell: JupyterFrontEnd.IShell;
  }
}
