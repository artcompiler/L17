/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/*
 * Copyright 2014 Art Compiler LLC
 * Copyright 2014 Learnosity Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var tokenizer = (function () {
  function token(kind, text) {
    if (!(this instanceof token)) {
      return new token(kind, text);
    }
    this.kind = kind;
    this.text = text;
    return this;
  }

  token.prototype.toString = function toString() {
    return this.text;
  }

  var TK_PUNC = 0x01;
  var TK_WORD = 0x02;
  var TK_WHITESPACE = 0x03;
  var TK_NUM = 0x04;
  var TK_MARKUP = 0x05;
  var TK_LATEX = 0x06;
  var PUNC_CHARS = [
    " ",
    "\t",
    "\n",
    ".",
    ",",
    "!",
    "?",
    "<",
    "'",
    "\"",
    "&",
    ";",
    // More puncuation characters here.
  ];

  var SENTENCE_PUNCTUATORS = [
    ".",
    "!",
    "?",
    // More punctuators here
  ];

  var BLOCK_TAGNAMES = [
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "ol",
    "p",
    "td",
    "th",
    "tr",
    "ul",
    // More tag names here.
  ];
  
  var ABBREV = [
    "Mr",
    "Mrs",
    // More abbreviations here.
  ];

  var ENTITIES = {
    "lt": 60,
    "gt": 62,
    // More entities here.
  };
  
  function isPuncChar(c) {
    var ch = String.fromCharCode(c);
    return PUNC_CHARS.indexOf(ch) >= 0;
  }

  function scanner(src) {

    var curIndex = 0;
    var lexeme = ""
    var prevIndex;   // Only works for one char of backup.
    var charStack = [];

    return {
      nextToken : nextToken ,
    }

    function prevChar() {
      return charStack[charStack.length-2];
    }

    function currChar() {
      return charStack[charStack.length-1];
    }

    function peekChar() {
      var c = nextChar();
      backupCurIndex();
      return c;
    }

    function pushChar(c) {
      if (charStack.length > 1) {
        charStack.shift();  // Throw away unused chars
      }
      charStack.push(c);
    }

    function nextChar() {
      var c, name;
      prevIndex = curIndex;
      if (curIndex >= src.length) {
        return 0;
      }
      c = src.charCodeAt(curIndex++);
      if (c === 38) { // ampersand
        name = "";
        while ((c = src.charCodeAt(curIndex++)) !== 59) {  // semicolon
          assert(curIndex < src.length, "Broken entity");
          name += String.fromCharCode(c);
        }
        c = ENTITIES[name];
        assert(c, "Unknown entity name");
      }
      pushChar(c);
      return c;
    }

    function backupCurIndex() {
      curIndex = prevIndex;
    }

    function nextToken() {
      var c, tk;
      lexeme = "";
      while ((c = nextChar())) {
        switch (c) {
        case 32:  // space
        case 9:   // tab
        case 10:  // new line
        case 13:  // carriage return
          lexeme += String.fromCharCode(c);
          return token(TK_WHITESPACE, lexeme);
        case 60:  // left angle
          tk = markup(c);
          if (isMarkup(tk, "<math>")) {
            return mathML(tk);
          }
          return tk;
        case 92:  // backslash
          return latex(c);
        case 33:  // exclamation
        case 34:  // double quote
        case 39:  // single quote
        case 40:  // left paren
        case 41:  // right paren
        case 42:  // asterisk
        case 43:  // plus
        case 44:  // comma
        case 45:  // dash
        case 46:  // period
        case 47:  // slash
        case 61:  // equal
        case 63:  // question
        case 91:  // left bracket
        case 93:  // right bracket
        case 94:  // caret
        case 123: // left brace
        case 125: // right brace
          lexeme += String.fromCharCode(c);
          return token(TK_PUNC, lexeme); // char code is the token id
        default:
          return word(c);
        }
      }

      function number(c) {
        var lexeme = "";
        while (c >= '0'.charCodeAt(0) && c <= '9'.charCodeAt(0) ||
               c === '.'.charCodeAt(0)) {
          lexeme += String.fromCharCode(c);
          c = nextChar();
        }
        backupCurIndex();
        return token(TK_NUM, lexeme);
      }

      function isPeriod(c, lexeme) {
        var c0;
        if (c === '.'.charCodeAt(0)) {
          if ((c0 = prevChar()) >= '0'.charCodeAt(0) &&
              c0 <= '9'.charCodeAt(0)) {
            // 1.2
            return false;
          } else if (ABBREV.indexOf(lexeme) >= 0) {
            // Mr. Fox
            return false;
          }
        }
        return true;
      }

      function word(c) {
        var lexeme = "";
        while (c && (!isPuncChar(c) || !isPeriod(c, lexeme))) {
          lexeme += String.fromCharCode(c);
          c = nextChar();
        }
        backupCurIndex();
        return token(TK_WORD, lexeme);
      }

      function mathML(tk) {
        var lexeme = "";
        lexeme += tk.text;
        while ((tk = nextToken()) && (tk.kind !== TK_MARKUP || !isMarkup(tk, "</math>"))) {
          lexeme += tk.text;
        }
        lexeme += tk.text;
        return token(TK_MARKUP, lexeme);
      }

      function markup(c) {
        var lexeme = "";
        lexeme += String.fromCharCode(c);
        c = nextChar();
        while (c && c !== '>'.charCodeAt(0)) {
          lexeme += String.fromCharCode(c);
          c = nextChar();
        }
        assert(c === ">".charCodeAt(0));
        lexeme += String.fromCharCode(c);
        return token(TK_MARKUP, lexeme);
      }

      // \( ... \) or \foo
      function latex(c) {
        var lexeme = "";
        lexeme += String.fromCharCode(c);
        c = nextChar();
        if (c === '('.charCodeAt(0)) {
          while (c && !(c === '\\'.charCodeAt(0) && peekChar() === ')'.charCodeAt(0))) {
            lexeme += String.fromCharCode(c);
            c = nextChar();
          }
          lexeme += String.fromCharCode(c);
          c = nextChar();
          lexeme += String.fromCharCode(c);
        } else {
          while (c && c >= 'a'.charCodeAt(0) && c <= 'z'.charCodeAt(0)) {
            lexeme += String.fromCharCode(c);
            c = nextChar();
          }
          backupCurIndex();
        }
        return token(TK_LATEX, lexeme);
      }
      return null;
    }
    return null;
  }

  var tokenizeWord = function (str, tokenClass) {
    var tk, scan, inSpan, text;
    scan = scanner(str);
    inSpan = false;
    text = "";
    while ((tk = scan.nextToken())) {
      if (isWord(tk)) {
        // Open span.
        text += "<span class='" + tokenClass + "'>";
        text += tk.toString();
        text += "</span>";
        inSpan = true;
      } else {
        text += tk.toString();
      }
    }
    return text;
  }

  var tokenizeSentence = function (str, delims, tokenClass) {
    var tk, scan, inSpan, text, ch;
    scan = scanner(str);
    inSpan = false;
    text = "";
    while ((tk = scan.nextToken())) {
      if (isWhitespace(tk) ||
          (isMarkup(tk) || isPunc(tk)) && !isSentenceDelimiter(tk)) {
        // Retain whitespace and markup as is.
        text += tk.toString();
      } else if (isSentenceDelimiter(tk)) {
        // Close span.
        if (text.length && (isPuncChar((ch = text[text.length - 1].charCodeAt(0))))) {
          // Don't include trailing punctuation (e.g. "'")
          text = text.substring(0, text.length - 1);
        }
        if (inSpan) {
          text += "</span>";
          inSpan = false;
        } // Otherwise do nothing, nothing to span.
        if (isPuncChar(ch)) {
          text += String.fromCharCode(ch);
        }
        text += tk.toString();
      } else if (!inSpan) {
        // Open span.
        text += "<span class='" + tokenClass + "'>";
        text += tk.toString();
        inSpan = true;
      } else if (tk === null) {
        // Close span. End of input.
        text += "</span>";
      } else {
        // Append token.
        text += tk.toString();
      }
    }
    return text;
  }

  var tokenizeParagraph = function (str, tokenClass) {
    var tk, scan, inSpan, text;
    scan = scanner(str);
    inSpan = false;
    text = "";
    while ((tk = scan.nextToken())) {
      if (isMarkup(tk)) {
        if (tagName(tk.text) === "p") {
          text += tk.toString();
          // Open span.
          if (inSpan) {
            // Close if not properly closed.
            text += "</span><span class='" + tokenClass + "'>";
          } else {
            text += "<span class='" + tokenClass + "'>";
          }
          inSpan = true;
        } else if (tagName(tk.text) === "/p" && inSpan) {
          // Close span.
          text += "</span>";
          inSpan = false;
          text += tk.toString();
        } else {
          // Copy any other markup to output.
          text += tk.toString();
        }
      } else {
        // Append all other tokens.
        text += tk.toString();
      }
    }
    return text;
  }

  function isWhitespace(tk) {
    return tk.kind === TK_WHITESPACE;
  }
  
  function isWord(tk) {
    return tk.kind === TK_WORD || tk.kind === TK_NUM || tk.kind === TK_LATEX;
  }

  function tagName(str) {
    // <foo  >, </foo>, <foo   />
    var c, start, stop;
    start = 1;
    stop = start;
    if (str[start] === "/") {
      stop++;
    }
    while ((c = str[stop]) >= "a" && c <= "z") {
      stop++;
    }
    return str.substring(start, stop);
  }

  function isSentenceDelimiter(tk) {
    return isPunc(tk) && SENTENCE_PUNCTUATORS.indexOf(tk.text) >= 0 ||
      isMarkup(tk) && BLOCK_TAGNAMES.indexOf(tagName(tk.text)) >= 0 ||
      isMarkup(tk) && BLOCK_TAGNAMES.indexOf(tagName(tk.text).substring(1)) >= 0;
  }

  function isPunc(tk) {
    return tk.kind === TK_PUNC;
  }

  function isMarkup(tk, name) {
    // If name is provided, then check it otherwise ignore token text.
    return tk.kind === TK_MARKUP && (!name || tk.text.toLowerCase() === name);
  }


  return {
    tokenizeWord: tokenizeWord,
    tokenizeSentence: tokenizeSentence,
    tokenizeParagraph: tokenizeParagraph,
  };
})();
