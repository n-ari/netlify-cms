import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import styled from '@emotion/styled';
import { ClassNames } from '@emotion/core';
import { debounce, isEqual } from 'lodash';
import { createEditor, Node, Editor } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { lengths, fonts } from 'netlify-cms-ui-default';
import { markdownToHtml } from '../serializers';
import { editorStyleVars, EditorControlBar } from '../styles';
import Toolbar from './Toolbar';

const styleStrings = {
  slateRaw: `
    position: relative;
    overflow: hidden;
    overflow-x: auto;
    min-height: ${lengths.richTextEditorMinHeight};
    font-family: ${fonts.mono};
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: 0;
    margin-top: -${editorStyleVars.stickyDistanceBottom};
  `,
};

const RawEditorContainer = styled.div`
  position: relative;
`;

export default class RawEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: (this.props.value || '')
        .split('\n')
        .map(text => ({ type: 'paragraph', children: [{ text }] })),
    };
    this.editor = withReact(withHistory(createEditor()));
    // MEMO: Slate 0.57.1 does NOT handle `paste without formatting` (shift-ctrl-v), that will be fixed by PR #3415 in ianstormtaylor/slate.
    // This problem will be automatically corrected if the PR is merged.
    this.editor.insertData = data => {
      const value = data
        .getData('text/plain')
        .split('\n')
        .map(text => ({ type: 'paragraph', children: [{ text }] }));
      Editor.insertFragment(this.editor, value);
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !isEqual(this.state.value, nextState.value);
  }

  componentDidMount() {
    if (this.props.pendingFocus) {
      this.editor.focus();
      this.props.pendingFocus();
    }
  }

  handleCopy = async event => {
    event.persist();
    const { getAsset, resolveWidget } = this.props;
    const fragment = Editor.fragment(this.editor, this.editor.selection);
    const markdown = fragment.map(n => Node.string(n)).join('\n');
    const html = await markdownToHtml(markdown, { getAsset, resolveWidget });
    event.clipboardData.setData('text/plain', markdown);
    event.clipboardData.setData('text/html', html);
    event.preventDefault();
  };

  handleCut = async event => {
    await this.handleCopy(event);
    Editor.deleteFragment(this.editor);
  };

  handleChange = value => {
    if (!isEqual(this.state.value, value)) {
      this.handleDocumentChange(value);
    }
    this.setState({ value });
  };

  /**
   * When the document value changes, serialize from Slate's AST back to plain
   * text (which is Markdown) and pass that up as the new value.
   */
  handleDocumentChange = debounce(value => {
    const markdown = value.map(n => Node.string(n)).join('\n');
    this.props.onChange(markdown);
  }, 150);

  handleToggleMode = () => {
    this.props.onMode('visual');
  };

  render() {
    const { className, field, t } = this.props;
    return (
      <RawEditorContainer>
        <EditorControlBar>
          <Toolbar
            onToggleMode={this.handleToggleMode}
            buttons={field['buttons']}
            disabled
            rawMode
            t={t}
          />
        </EditorControlBar>
        <ClassNames>
          {({ css, cx }) => (
            <Slate editor={this.editor} value={this.state.value} onChange={this.handleChange} t={t}>
              <Editable
                className={cx(
                  className,
                  css`
                    ${styleStrings.slateRaw}
                  `,
                )}
                onCut={this.handleCut}
                onCopy={this.handleCopy}
              />
            </Slate>
          )}
        </ClassNames>
      </RawEditorContainer>
    );
  }
}

RawEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  onMode: PropTypes.func.isRequired,
  className: PropTypes.string.isRequired,
  value: PropTypes.string,
  field: ImmutablePropTypes.map.isRequired,
  t: PropTypes.func.isRequired,
};
