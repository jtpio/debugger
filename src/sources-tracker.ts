import { JupyterFrontEnd } from '@jupyterlab/application';

import { MainAreaWidget, DOMUtils, WidgetTracker } from '@jupyterlab/apputils';

import { CodeEditorWrapper, IEditorServices } from '@jupyterlab/codeeditor';

import { PathExt } from '@jupyterlab/coreutils';

import { textEditorIcon } from '@jupyterlab/ui-components';

import { IDisposable } from '@lumino/disposable';

import { Signal } from '@lumino/signaling';

import { EditorHandler } from './handlers/editor';

import { DebuggerModel } from './model';

import { ReadOnlyEditorFactory } from './sources/factory';

import { SourcesModel } from './sources/model';

import { IDebugger } from './tokens';

/**
 * A class that tracks the source of code cells.
 */
export class SourcesTracker implements IDisposable {
  /**
   * Instantiate a new SourcesHandler.
   *
   * @param options The instantiation options for a SourcesHandler.
   */
  constructor(options: SourcesTracker.IOptions) {
    this._debuggerService = options.debuggerService;
    this._shell = options.shell;
    this._readOnlyEditorFactory = new ReadOnlyEditorFactory({
      editorServices: options.editorServices
    });
    this._readOnlyEditorTracker = options.readOnlyEditorTracker;

    this._editorFinder = options.editorFinder;
    this._onModelChanged();
    this._debuggerService.modelChanged.connect(this._onModelChanged, this);
  }

  /**
   * Whether the handler is disposed.
   */
  isDisposed: boolean;

  /**
   * Dispose the handler.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * Handle when the debug model changes.
   */
  private _onModelChanged(): void {
    this._debuggerModel = this._debuggerService.model as DebuggerModel;
    if (!this._debuggerModel) {
      return;
    }

    this._debuggerModel.sources.currentSourceOpened.connect(
      this._onCurrentSourceOpened,
      this
    );

    this._debuggerModel.breakpoints.clicked.connect(async (_, breakpoint) => {
      const path = breakpoint.source.path;
      const source = await this._debuggerService.getSource({
        sourceReference: 0,
        path
      });
      this._onCurrentSourceOpened(null, source);
    });
  }

  /**
   * Handle a source open event.
   *
   * @param _ The sender.
   * @param source The source to open.
   */
  private _onCurrentSourceOpened(
    _: SourcesModel,
    source: IDebugger.ISource
  ): void {
    if (!source) {
      return;
    }
    const { content, mimeType, path } = source;
    const results = this._editorFinder.find({
      focus: false,
      kernel: this._debuggerService.session.connection.kernel.name,
      path: this._debuggerService.session.connection.path,
      source: path
    });
    if (results.next()) {
      return;
    }
    const editorWrapper = this._readOnlyEditorFactory.createNewEditor({
      content,
      mimeType,
      path
    });
    const editor = editorWrapper.editor;
    const editorHandler = new EditorHandler({
      debuggerService: this._debuggerService,
      editor,
      path
    });
    const widget = new MainAreaWidget<CodeEditorWrapper>({
      content: editorWrapper
    });
    widget.id = DOMUtils.createDomID();
    widget.title.label = PathExt.basename(path);
    widget.title.closable = true;
    widget.title.caption = path;
    widget.title.icon = textEditorIcon;
    widget.disposed.connect(() => editorHandler.dispose());
    this._shell.add(widget, 'main');
    void this._readOnlyEditorTracker.add(widget);

    const frame = this._debuggerModel?.callstack.frame;
    if (frame) {
      EditorHandler.showCurrentLine(editor, frame.line);
    }
  }

  private _debuggerModel: DebuggerModel;
  private _debuggerService: IDebugger;
  private _editorFinder: IDebugger.IEditorFinder | null;
  private _readOnlyEditorFactory: ReadOnlyEditorFactory;
  private _readOnlyEditorTracker: WidgetTracker<
    MainAreaWidget<CodeEditorWrapper>
  >;
  private _shell: JupyterFrontEnd.IShell;
}

/**
 * A namespace for SourcesTracker statics.
 */
export namespace SourcesTracker {
  /**
   * The options used to initialize a SourcesTracker object.
   */
  export interface IOptions {
    /**
     * The debugger service.
     */
    debuggerService: IDebugger;

    /**
     * The editor finder.
     */
    editorFinder: IDebugger.IEditorFinder;

    /**
     * The editor services.
     */
    editorServices: IEditorServices;

    /**
     * The read-only editor tracker.
     */
    readOnlyEditorTracker: WidgetTracker<MainAreaWidget<CodeEditorWrapper>>;

    /**
     * The application shell.
     */
    shell: JupyterFrontEnd.IShell;
  }
}
