import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];
const components: Components = {
  a: ({ node: _node, href, ...props }) => (
    <a
      {...props}
      href={href || undefined}
      target={href && !href.startsWith('#') ? '_blank' : undefined}
      rel="noopener noreferrer"
    />
  ),
};

export const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="dxp-ai-markdown">
      <Markdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
