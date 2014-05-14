/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

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
  var PUNC_CHARS = " \t\n.,!?<'\"";
  var DELIMS = [
    ".",
    "!",
    "?",
    "<p>",
    "<li>",
    "</li>",
    "<ol>",
    "</ol>",
    "<tr>",
    "</tr>",
    "<td>",
    "</td>",
  ];
  
  var ABBREV = [
    "Mr",
    "Mrs",
  ];
  
  function isPuncChar(c) {
    var ch = String.fromCharCode(c);
    return PUNC_CHARS.indexOf(ch) >= 0;
  }

  function scanner(src) {

    var curIndex = 0;
    var lexeme = "";

    return {
      nextToken : nextToken ,
      lexeme : function () { return lexeme } ,
    }

    function nextToken() {
      var c;
      lexeme = "";
      while (curIndex < src.length) {
        switch ((c = src.charCodeAt(curIndex++))) {
        case 32:  // space
        case 9:   // tab
        case 10:  // new line
        case 13:  // carriage return
          lexeme += String.fromCharCode(c);
          return token(TK_WHITESPACE, lexeme);
        case 60:  // left angle
          return markup(c);
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
        while (c >= '0'.charCodeAt(0) && c <= '9'.charCodeAt(0) ||
               c === '.'.charCodeAt(0)) {
          lexeme += String.fromCharCode(c);
          c = src.charCodeAt(curIndex++);
        }
        curIndex--;
        
        return token(TK_NUM, lexeme);
      }

      function isPeriod(c) {
        var c0;
        if (c === '.'.charCodeAt(0)) {
          if ((c0 = src.charCodeAt(curIndex)) >= '0'.charCodeAt(0) &&
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
        var c0;
        while (!isPuncChar(c) || !isPeriod(c)) {
//               (c === '.'.charCodeAt(0) &&
//                (c0 = src.charCodeAt(curIndex)) >= '0'.charCodeAt(0) && c0 <= '9'.charCodeAt(0))) {
          lexeme += String.fromCharCode(c);
          c = src.charCodeAt(curIndex++);
        }
        curIndex--;
        return token(TK_WORD, lexeme);
      }

      function markup(c) {
        lexeme += String.fromCharCode(c);
        c = src.charCodeAt(curIndex++);
        while (c !== '>'.charCodeAt(0)) {
          lexeme += String.fromCharCode(c);
          c = src.charCodeAt(curIndex++);
        }
        assert(c === ">".charCodeAt(0));
        lexeme += String.fromCharCode(c);
        return token(TK_MARKUP, lexeme);
      }

      // \( ... \) or \foo
      function latex(c) {
        lexeme += String.fromCharCode(c);
        c = src.charCodeAt(curIndex++);
        if (c === '('.charCodeAt(0)) {
          while (!(c === '\\'.charCodeAt(0) && src.charCodeAt(curIndex) === ')'.charCodeAt(0))) {
            lexeme += String.fromCharCode(c);
            c = src.charCodeAt(curIndex++);
          }
          lexeme += String.fromCharCode(c);
          c = src.charCodeAt(curIndex++);
          lexeme += String.fromCharCode(c);
        } else {
          while (c >= 'a'.charCodeAt(0) && c <= 'z'.charCodeAt(0)) {
            lexeme += String.fromCharCode(c);
            c = src.charCodeAt(curIndex++);
          }
          curIndex--;
        }
        return token(TK_LATEX, lexeme);
      }
      return null;
    }
    return null;
  }

  var tokenizeWord = function (str, tokenClass) {
    var t, scan, inSpan, text;
    scan = scanner(str);
    inSpan = false;
    text = "";
    while ((t = scan.nextToken())) {
      if (isWord(t)) {
        // Open span.
        text += "<span class=" + tokenClass + ">";
        text += t.toString();
        text += "</span>";
        text += "\n";
        inSpan = true;
      } else {
        text += t.toString();
      }
    }
    return text;
  }

  var tokenizeSentence = function (str, delims, tokenClass) {
    var t, scan, inSpan, text, ch;
    scan = scanner(str);
    inSpan = false;
    text = "";
    while ((t = scan.nextToken())) {
      if (isWhitespace(t) ||
          (isMarkup(t) || isPunc(t)) && !isDelimiter(t, delims)) {
        // Retain whitespace and markup as is.
        text += t.toString();
      } else if (isDelimiter(t, delims)) {
        // Close span.
        if (text.length && (isPuncChar((ch = text[text.length - 1].charCodeAt(0))))) {
          // Don't include trailing punctuation (e.g. "'")
          text = text.substring(0, text.length - 1);
        }
        if (inSpan) {
          text += "</span>";
          text += "\n";
          inSpan = false;
        } // Otherwise do nothing, nothing to span.
        if (isPuncChar(ch)) {
          text += String.fromCharCode(ch);
        }
        text += t.toString();
      } else if (!inSpan) {
        // Open span.
        text += "<span class=" + tokenClass + ">";
        text += t.toString();
        inSpan = true;
      } else if (t === null) {
        // Close span. End of input.
        text += "</span>";
      } else {
        // Append token.
        text += t.toString();
      }
    }
    return text;
  }

  var tokenizeParagraph = function (str, tokenClass) {
    var t, scan, inSpan, text;
    scan = scanner(str);
    inSpan = false;
    text = "";
    while ((t = scan.nextToken())) {
      if (isMarkup(t)) {
        if (t.text === "<p>") {
          // Open span.
          if (inSpan) {
            // Close if not properly closed.
            text += "</p><p class=" + tokenClass + ">";
          } else {
            text += "<p class=" + tokenClass + ">";
          }
          inSpan = true;
        } else if (t.text === "</p>" && inSpan) {
          // Close span.
          text += "</p>";
          text += "\n";
          inSpan = false;
        } else {
          // Copy any other markup to output.
          text += t.toString();
        }
      } else {
        // Append all other tokens.
        text += t.toString();
      }
    }
    return text;
  }

  function isWhitespace(t) {
    return t.kind === TK_WHITESPACE;
  }
  
  function isWord(t) {
    return t.kind === TK_WORD || t.kind === TK_NUM || t.kind === TK_LATEX;
  }

  function isDelimiter(t, delims) {    
    return (t.kind === TK_MARKUP || t.kind === TK_PUNC) &&
      DELIMS.indexOf(t.text.toLowerCase()) >= 0;
  }

  function isPunc(t) {
    return t.kind === TK_PUNC;
  }

  function isMarkup(t) {
    return t.kind === TK_MARKUP;
  }


  return {
    tokenizeWord: tokenizeWord,
    tokenizeSentence: tokenizeSentence,
    tokenizeParagraph: tokenizeParagraph,
  };
})()
