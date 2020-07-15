/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { each } from '@lumino/algorithm';

import { IDisposable } from '@lumino/disposable';

import { Signal } from '@lumino/signaling';

import { EditorHandler } from './editor';

import { CallstackModel } from '../callstack/model';

import { IDebugger } from '../tokens';

import { DebuggerModel } from '../model';

/**
 * A class which handles notebook, console and editor trackers.
 */
export class TrackerHandler implements IDisposable {
  /**
   * Instantiate a new TrackerHandler.
   *
   * @param options The instantiation options for a TrackerHandler.
   */
  constructor(options: TrackerHandler.IOptions) {
    this._debuggerService = options.debuggerService;
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

    this._debuggerModel.callstack.currentFrameChanged.connect(
      this._onCurrentFrameChanged,
      this
    );
  }

  /**
   * Handle a current frame changed event.
   *
   * @param _ The sender.
   * @param frame The current frame.
   */
  private _onCurrentFrameChanged(
    _: CallstackModel,
    frame: CallstackModel.IFrame
  ): void {
    each(
      this._editorFinder.find({
        focus: true,
        kernel: this._debuggerService.session.connection.kernel.name,
        path: this._debuggerService.session?.connection?.path,
        source: frame?.source.path ?? null
      }),
      editor => {
        requestAnimationFrame(() => {
          EditorHandler.showCurrentLine(editor, frame.line);
        });
      }
    );
  }

  private _debuggerModel: DebuggerModel;
  private _debuggerService: IDebugger;
  private _editorFinder: IDebugger.IEditorFinder | null;
}

/**
 * A namespace for TrackerHandler statics.
 */
export namespace TrackerHandler {
  /**
   * The options used to initialize a TrackerHandler object.
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
  }
}
