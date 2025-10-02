/**
 * Collaborative Code Editor Component
 *
 * Monaco Editor integration with WebSocket synchronization
 * for real-time collaborative coding during interviews
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import {
  Box,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import {
  CodeEditorProps,
  ProgrammingLanguage,
  EditorTheme,
  CodeEdit,
  CollaborativeCursor,
  CodeExecutionResult,
} from '../types';

// Language configuration
const LANGUAGE_OPTIONS: { value: ProgrammingLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
];

const STARTER_CODE: Record<ProgrammingLanguage, string> = {
  javascript: `// JavaScript Interview Question
function solution() {
  // Your code here
  
  return result;
}

console.log(solution());`,
  typescript: `// TypeScript Interview Question
function solution(): any {
  // Your code here
  
  return result;
}

console.log(solution());`,
  python: `# Python Interview Question
def solution():
    # Your code here
    
    return result

print(solution())`,
  java: `// Java Interview Question
public class Solution {
    public static void main(String[] args) {
        // Your code here
        
    }
}`,
  csharp: `// C# Interview Question
using System;

class Solution {
    static void Main() {
        // Your code here
        
    }
}`,
  cpp: `// C++ Interview Question
#include <iostream>
using namespace std;

int main() {
    // Your code here
    
    return 0;
}`,
  go: `// Go Interview Question
package main

import "fmt"

func main() {
    // Your code here
    
}`,
  rust: `// Rust Interview Question
fn main() {
    // Your code here
    
}`,
  ruby: `# Ruby Interview Question
def solution
  # Your code here
  
end

puts solution()`,
  php: `<?php
// PHP Interview Question
function solution() {
    // Your code here
    
    return $result;
}

echo solution();
?>`,
  swift: `// Swift Interview Question
func solution() {
    // Your code here
    
}

solution()`,
  kotlin: `// Kotlin Interview Question
fun main() {
    // Your code here
    
}`,
  scala: `// Scala Interview Question
object Solution {
  def main(args: Array[String]): Unit = {
    // Your code here
    
  }
}`,
  r: `# R Interview Question
solution <- function() {
  # Your code here
  
  return(result)
}

print(solution())`,
  sql: `-- SQL Interview Question
SELECT *
FROM table_name
WHERE condition;`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Document</title>
</head>
<body>
    <!-- Your code here -->
    
</body>
</html>`,
  css: `/* CSS Styling */
.container {
  /* Your code here */
  
}`,
  json: `{
  "key": "value"
}`,
  yaml: `# YAML Configuration
key: value`,
  markdown: `# Markdown Document

Your content here.`,
};

export const CollaborativeCodeEditor: React.FC<CodeEditorProps> = ({
  sessionId,
  interviewId,
  currentUserId,
  readOnly = false,
  onCodeChange,
  onExecute,
}) => {
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<ProgrammingLanguage>('javascript');
  const [theme, setTheme] = useState<EditorTheme>('vs-light');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<CodeExecutionResult | null>(null);
  const [cursors, setCursors] = useState<CollaborativeCursor[]>([]);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Apply remote edit from another participant
  const applyRemoteEdit = useCallback((edit: CodeEdit) => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const range = new monacoRef.current.Range(
          edit.range.startLine,
          edit.range.startColumn,
          edit.range.endLine,
          edit.range.endColumn,
        );

        model.pushEditOperations([], [{ range, text: edit.text }], () => null);
      }
    }
  }, []);

  // Update remote cursor position
  const updateRemoteCursor = useCallback((cursor: CollaborativeCursor) => {
    setCursors((prev) => {
      const filtered = prev.filter((c) => c.user_id !== cursor.user_id);
      return [...filtered, cursor];
    });
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case 'code_edit':
          if (message.sender_id !== currentUserId) {
            applyRemoteEdit(message.payload);
          }
          break;

        case 'cursor_move':
          if (message.sender_id !== currentUserId) {
            updateRemoteCursor(message.payload.cursor);
          }
          break;

        case 'language_change':
          setLanguage(message.payload.language);
          break;

        case 'sync_response':
          setCode(message.payload.code);
          setLanguage(message.payload.language);
          setCursors(message.payload.cursors);
          break;

        case 'execution_result':
          setExecutionResult(message.payload);
          setIsExecuting(false);
          break;

        case 'participant_join':
          console.log('Participant joined:', message.payload);
          break;

        case 'participant_leave':
          setCursors((prev) => prev.filter((c) => c.user_id !== message.payload.user_id));
          break;
      }
    },
    [currentUserId, applyRemoteEdit, updateRemoteCursor],
  );

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8080/code-session/${sessionId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Request initial sync
      ws.send(
        JSON.stringify({
          type: 'sync_request',
          sender_id: currentUserId,
          timestamp: new Date().toISOString(),
        }),
      );
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionId, currentUserId, handleWebSocketMessage]);

  // Handle editor mount
  const handleEditorMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Listen for cursor changes
    editor.onDidChangeCursorPosition((e: any) => {
      const position = e.position;
      sendCursorUpdate(position.lineNumber, position.column);
    });

    // Listen for content changes
    editor.onDidChangeModelContent((e: any) => {
      const changes = e.changes;
      changes.forEach((change: any) => {
        sendCodeEdit(change);
      });
    });
  };

  // Handle code change
  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      onCodeChange?.(value);
    }
  };

  // Send code edit to other participants
  const sendCodeEdit = (change: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const edit: CodeEdit = {
        type: change.text ? 'insert' : 'delete',
        range: {
          startLine: change.range.startLineNumber,
          startColumn: change.range.startColumn,
          endLine: change.range.endLineNumber,
          endColumn: change.range.endColumn,
        },
        text: change.text,
        user_id: currentUserId,
        timestamp: new Date().toISOString(),
      };

      wsRef.current.send(
        JSON.stringify({
          type: 'code_edit',
          payload: edit,
          sender_id: currentUserId,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  };

  // Send cursor update
  const sendCursorUpdate = (line: number, column: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'cursor_move',
          payload: {
            cursor: {
              user_id: currentUserId,
              user_name: 'User', // Would come from user profile
              color: '#' + Math.floor(Math.random() * 16777215).toString(16),
              position: { line, column },
            },
          },
          sender_id: currentUserId,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  };

  // Handle language change
  const handleLanguageChange = (newLanguage: ProgrammingLanguage) => {
    setLanguage(newLanguage);
    setCode(STARTER_CODE[newLanguage] || '');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'language_change',
          payload: { language: newLanguage },
          sender_id: currentUserId,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  };

  // Execute code
  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'code_execute',
          payload: { code, language },
          sender_id: currentUserId,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    // Simulate execution for demo purposes
    // In production, this would be handled by a secure backend sandbox
    setTimeout(() => {
      const result: CodeExecutionResult = {
        timestamp: new Date().toISOString(),
        output: 'Code execution would be handled by a secure backend sandbox.',
        runtime_ms: 150,
        exit_code: 0,
      };
      setExecutionResult(result);
      setIsExecuting(false);
      onExecute?.(result);
    }, 1500);
  };

  // Copy code to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  // Download code as file
  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-code.${language}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      {/* Toolbar */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Language</InputLabel>
            <Select
              value={language}
              label="Language"
              onChange={(e) => handleLanguageChange(e.target.value as ProgrammingLanguage)}
              disabled={readOnly}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Theme</InputLabel>
            <Select
              value={theme}
              label="Theme"
              onChange={(e) => setTheme(e.target.value as EditorTheme)}
            >
              <MenuItem value="vs-light">Light</MenuItem>
              <MenuItem value="vs-dark">Dark</MenuItem>
              <MenuItem value="hc-black">High Contrast</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Copy Code">
            <IconButton onClick={handleCopy} size="small">
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Download Code">
            <IconButton onClick={handleDownload} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            color="primary"
            startIcon={isExecuting ? <StopIcon /> : <PlayArrowIcon />}
            onClick={handleExecute}
            disabled={readOnly || isExecuting || !code.trim()}
          >
            {isExecuting ? 'Running...' : 'Run Code'}
          </Button>
        </Stack>
      </Paper>

      {/* Monaco Editor */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Editor
          height="100%"
          language={language}
          theme={theme}
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          options={{
            readOnly,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </Paper>

      {/* Execution Result */}
      {executionResult && (
        <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
          <Typography variant="subtitle2" gutterBottom>
            Output:
          </Typography>
          <Typography
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              m: 0,
            }}
          >
            {executionResult.output || executionResult.error || 'No output'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Runtime: {executionResult.runtime_ms}ms | Exit Code: {executionResult.exit_code}
          </Typography>
        </Paper>
      )}

      {/* Active Participants */}
      {cursors.length > 0 && (
        <Paper sx={{ p: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Active:
            </Typography>
            {cursors.map((cursor) => (
              <Box
                key={cursor.user_id}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: cursor.color,
                }}
                title={cursor.user_name}
              />
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default CollaborativeCodeEditor;
