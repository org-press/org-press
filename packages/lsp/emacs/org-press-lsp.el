;;; org-press-lsp.el --- LSP client for org-press -*- lexical-binding: t; -*-

;; Copyright (C) 2026

;; Author: Org-Press Team
;; Version: 0.1.0
;; Package-Requires: ((emacs "27.1") (lsp-mode "8.0.0"))
;; Keywords: languages, org-mode, lsp, typescript
;; URL: https://github.com/org-press/org-press

;; This file is free software; you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation; either version 2, or (at your option)
;; any later version.

;; This file is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.

;; You should have received a copy of the GNU General Public License
;; along with GNU Emacs; see the file COPYING.  If not, write to
;; the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
;; Boston, MA 02110-1301, USA.

;;; Commentary:

;; LSP client for org-press that provides IDE features for code blocks
;; in org-mode files.
;;
;; Features:
;; - Auto-completion in TypeScript/JavaScript code blocks
;; - Hover information with type signatures
;; - Go-to-definition within code blocks
;; - Type-checking diagnostics
;;
;; Installation:
;;
;; 1. Install the org-press-lsp server:
;;    npm install -g @org-press/lsp
;;    (or use npx @org-press/lsp directly)
;;
;; 2. Add this file to your load-path and require it:
;;    (add-to-list 'load-path "/path/to/org-press/packages/lsp/emacs")
;;    (require 'org-press-lsp)
;;
;; 3. Enable for org-mode:
;;    (add-hook 'org-mode-hook #'org-press-lsp-enable)
;;
;; Or with use-package:
;;
;;    (use-package org-press-lsp
;;      :load-path "/path/to/org-press/packages/lsp/emacs"
;;      :hook (org-mode . org-press-lsp-enable))
;;
;; Configuration:
;;
;; Customize `org-press-lsp-server-command' to change how the server is started.
;; By default, it uses npx to run the server.

;;; Code:

(require 'lsp-mode)

(defgroup org-press-lsp nil
  "LSP support for org-press code blocks."
  :group 'lsp-mode
  :link '(url-link "https://github.com/org-press/org-press"))

(defcustom org-press-lsp-server-command '("npx" "@org-press/lsp")
  "Command to start the org-press LSP server.

This can be customized to use a local installation or specific path.

Examples:
  - Use npx: '(\"npx\" \"@org-press/lsp\")
  - Use global install: '(\"org-press-lsp\")
  - Use local path: '(\"node\" \"/path/to/packages/lsp/dist/bin/org-press-lsp.js\")"
  :type '(repeat string)
  :group 'org-press-lsp)

(defcustom org-press-lsp-content-dir "content"
  "Content directory containing org files.

This is passed to the LSP server as an initialization option."
  :type 'string
  :group 'org-press-lsp)

(defcustom org-press-lsp-enable-diagnostics t
  "Enable TypeScript diagnostics in org files.

When non-nil, the server will report type errors in code blocks."
  :type 'boolean
  :group 'org-press-lsp)

(defcustom org-press-lsp-auto-activate t
  "Automatically activate LSP when opening org files in org-press projects.

When non-nil, LSP will be activated for any org file in a directory
that contains a .org-press configuration directory."
  :type 'boolean
  :group 'org-press-lsp)

;; Register org-mode with lsp-mode
(add-to-list 'lsp-language-id-configuration '(org-mode . "org"))

(defun org-press-lsp--server-command ()
  "Return the command to start the org-press LSP server."
  org-press-lsp-server-command)

(defun org-press-lsp--initialization-options ()
  "Return initialization options for the org-press LSP server."
  (let ((project-root (org-press-lsp--find-org-press-root)))
    (when project-root
      ;; Expand ~ and other special paths to absolute path
      (setq project-root (expand-file-name project-root))
      ;; Remove trailing slash if present
      (when (string-suffix-p "/" project-root)
        (setq project-root (substring project-root 0 -1))))
    (list :contentDir org-press-lsp-content-dir
          :enableDiagnostics (if org-press-lsp-enable-diagnostics t :json-false)
          :projectRoot project-root)))

(defun org-press-lsp--find-org-press-root ()
  "Find the org-press project root by searching upward for .org-press directory.

Returns the directory containing .org-press, or nil if not found."
  (when buffer-file-name
    (locate-dominating-file buffer-file-name ".org-press")))

(defun org-press-lsp--is-org-press-project-p ()
  "Check if the current directory is an org-press project.

Returns t if a .org-press directory exists in any parent directory."
  (org-press-lsp--find-org-press-root))

;; Register the LSP client
(lsp-register-client
 (make-lsp-client
  :new-connection (lsp-stdio-connection #'org-press-lsp--server-command)
  :major-modes '(org-mode)
  :activation-fn (lambda (filename mode)
                   (and (eq mode 'org-mode)
                        (or (not org-press-lsp-auto-activate)
                            (org-press-lsp--is-org-press-project-p))))
  :server-id 'org-press-lsp
  :priority -1  ; Lower priority than other LSP servers
  :initialization-options #'org-press-lsp--initialization-options
  :initialized-fn (lambda (workspace)
                    (message "[org-press-lsp] Connected to server"))
  :notification-handlers
  (lsp-ht ("org-press/blockUpdate" #'org-press-lsp--handle-block-update)
          ("org-press/progress" #'org-press-lsp--handle-progress))))

(defun org-press-lsp--handle-block-update (_workspace params)
  "Handle block update notifications from the server.
PARAMS contains the update information."
  (when-let ((file (gethash "file" params))
             (blocks (gethash "blocks" params)))
    (message "[org-press-lsp] Blocks updated in %s: %d blocks" file (length blocks))))

(defun org-press-lsp--handle-progress (_workspace params)
  "Handle progress notifications from the server.
PARAMS contains the progress information."
  (when-let ((message (gethash "message" params)))
    (lsp--info "[org-press] %s" message)))

;;;###autoload
(defun org-press-lsp-enable ()
  "Enable org-press-lsp for the current buffer.

This activates LSP mode with the org-press server for the current
org-mode buffer."
  (interactive)
  (when (derived-mode-p 'org-mode)
    (lsp-deferred)))

;;;###autoload
(defun org-press-lsp-disable ()
  "Disable org-press-lsp for the current buffer."
  (interactive)
  (lsp-disconnect))

;;;###autoload
(defun org-press-lsp-restart ()
  "Restart the org-press LSP server."
  (interactive)
  (lsp-restart-workspace))

;;;###autoload
(defun org-press-lsp-describe-thing-at-point ()
  "Show hover information for the symbol at point."
  (interactive)
  (lsp-describe-thing-at-point))

;;;###autoload
(defun org-press-lsp-goto-definition ()
  "Go to the definition of the symbol at point."
  (interactive)
  (lsp-find-definition))

;;;###autoload
(defun org-press-lsp-find-references ()
  "Find references to the symbol at point."
  (interactive)
  (lsp-find-references))

;; Keymap for org-press-lsp commands
(defvar org-press-lsp-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "C-c C-d") #'org-press-lsp-describe-thing-at-point)
    (define-key map (kbd "C-c C-.") #'org-press-lsp-goto-definition)
    (define-key map (kbd "C-c C-r") #'org-press-lsp-find-references)
    map)
  "Keymap for `org-press-lsp-mode'.")

;;;###autoload
(define-minor-mode org-press-lsp-mode
  "Minor mode for org-press LSP integration.

\\{org-press-lsp-mode-map}"
  :lighter " OrgPressLSP"
  :keymap org-press-lsp-mode-map
  :group 'org-press-lsp
  (if org-press-lsp-mode
      (org-press-lsp-enable)
    (org-press-lsp-disable)))

;; Automatically enable for org-mode in org-press projects
(defun org-press-lsp--maybe-enable ()
  "Enable org-press-lsp if in an org-press project."
  (when (and buffer-file-name
             (string-match-p "\\.org$" buffer-file-name)
             org-press-lsp-auto-activate
             (org-press-lsp--is-org-press-project-p))
    (org-press-lsp-mode 1)))

;;;###autoload
(defun org-press-lsp-setup ()
  "Set up org-press-lsp with auto-activation.

Call this in your init file to automatically enable org-press-lsp
for org files in org-press projects."
  (add-hook 'org-mode-hook #'org-press-lsp--maybe-enable))

(provide 'org-press-lsp)

;;; org-press-lsp.el ends here
