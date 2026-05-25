/**
 * TermiTodo - Command Line & GUI To-Do Dual State Engine
 * Built with Vanilla JavaScript
 */

// --- 1. CONFIGURATION & STATE SYSTEM ---
const Themes = ['cyberpunk', 'matrix', 'dracula', 'synthwave', 'slate'];

let state = {
    todos: [],
    history: [], // CLI command history
    historyIndex: -1,
    currentFilter: 'all', // all, active, completed, high
    currentSearch: '',
    crtActive: true
};

// Default setup when storage is empty
const DEFAULT_TODOS = [
    { id: 1, text: "Build a state-of-the-art dual-state engine interface", completed: false, priority: "high", tags: ["project", "web"], createdAt: Date.now() },
    { id: 2, text: "Explore cyberpunk themes via terminal command 'theme list'", completed: false, priority: "medium", tags: ["system"], createdAt: Date.now() - 3600000 },
    { id: 3, text: "Finished configuring local storage persistence", completed: true, priority: "low", tags: ["storage"], createdAt: Date.now() - 7200000 }
];

// --- 2. SELECTORS ---
const el = {
    body: document.body,
    crtOverlay: document.getElementById('crt-overlay'),
    themeSelect: document.getElementById('theme-select'),
    toggleCrtBtn: document.getElementById('toggle-crt-btn'),
    clearTermBtn: document.getElementById('clear-term-btn'),
    terminalBody: document.getElementById('terminal-body'),
    terminalOutput: document.getElementById('terminal-output'),
    terminalInput: document.getElementById('terminal-input'),
    promptCommandDisplay: document.getElementById('prompt-command-display'),
    autocompleteSuggestion: document.getElementById('autocomplete-suggestion'),
    
    // GUI actions
    exportBtn: document.getElementById('export-btn'),
    importBtnTrigger: document.getElementById('import-btn-trigger'),
    importFileInput: document.getElementById('import-file-input'),
    
    // Stats
    completionRate: document.getElementById('completion-rate'),
    progressCircle: document.getElementById('progress-circle'),
    statTotal: document.getElementById('stat-total'),
    statPending: document.getElementById('stat-pending'),
    statCompleted: document.getElementById('stat-completed'),
    
    // Filter & Search
    guiSearchInput: document.getElementById('gui-search-input'),
    filterPills: document.querySelectorAll('.filter-pill'),
    
    // Quick Add
    quickAddForm: document.getElementById('quick-add-form'),
    quickAddInput: document.getElementById('quick-add-input'),
    quickAddPriority: document.getElementById('quick-add-priority'),
    quickAddTags: document.getElementById('quick-add-tags'),
    
    // List
    taskList: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    
    // Clock
    clockDisplay: document.getElementById('clock-display')
};

// --- 3. INITIALIZATION ---
function init() {
    // Load local storage
    loadFromLocalStorage();
    
    // Setup listeners
    setupEventListeners();
    
    // Render initial states
    renderAll();
    
    // Auto focus terminal input
    setTimeout(() => el.terminalInput.focus(), 100);
    
    // Start clock
    updateClock();
    setInterval(updateClock, 1000);
    
    logToTerminal("System initialized. Welcome.", "success");
}

// --- 4. STATE SAVE / LOAD ---
function saveToLocalStorage() {
    localStorage.setItem('termitodo_todos', JSON.stringify(state.todos));
    localStorage.setItem('termitodo_history', JSON.stringify(state.history));
    localStorage.setItem('termitodo_crt', JSON.stringify(state.crtActive));
}

function loadFromLocalStorage() {
    // Load Todos
    const rawTodos = localStorage.getItem('termitodo_todos');
    if (rawTodos) {
        try {
            state.todos = JSON.parse(rawTodos);
        } catch (e) {
            state.todos = [...DEFAULT_TODOS];
        }
    } else {
        state.todos = [...DEFAULT_TODOS];
    }
    
    // Load CLI history
    const rawHistory = localStorage.getItem('termitodo_history');
    if (rawHistory) {
        try {
            state.history = JSON.parse(rawHistory);
        } catch (e) {}
    }
    
    // Load CRT setting
    const rawCrt = localStorage.getItem('termitodo_crt');
    if (rawCrt !== null) {
        state.crtActive = JSON.parse(rawCrt);
        updateCrtState();
    }
    
    // Load active theme
    const activeTheme = localStorage.getItem('termitodo_theme') || 'cyberpunk';
    setTheme(activeTheme);
    el.themeSelect.value = activeTheme;
}

// --- 5. RENDER SYSTEM ---
function renderAll() {
    renderDashboardStats();
    renderTaskList();
}

function renderDashboardStats() {
    const total = state.todos.length;
    const completed = state.todos.filter(t => t.completed).length;
    const pending = total - completed;
    
    el.statTotal.textContent = total;
    el.statCompleted.textContent = completed;
    el.statPending.textContent = pending;
    
    // Completion rate progress circle
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    el.completionRate.textContent = `${rate}%`;
    
    // SVG stroke-dasharray has circumference of 100 (using 2 * PI * r = 100 approx)
    el.progressCircle.setAttribute('stroke-dasharray', `${rate}, 100`);
}

function renderTaskList() {
    el.taskList.innerHTML = '';
    
    // Apply filters
    let filtered = state.todos;
    
    if (state.currentFilter === 'active') {
        filtered = filtered.filter(t => !t.completed);
    } else if (state.currentFilter === 'completed') {
        filtered = filtered.filter(t => t.completed);
    } else if (state.currentFilter === 'high') {
        filtered = filtered.filter(t => t.priority === 'high');
    }
    
    if (state.currentSearch.trim() !== '') {
        const query = state.currentSearch.toLowerCase();
        filtered = filtered.filter(t => 
            t.text.toLowerCase().includes(query) || 
            t.tags.some(tag => tag.toLowerCase().includes(query)) ||
            t.id.toString() === query
        );
    }
    
    if (filtered.length === 0) {
        el.emptyState.style.display = 'flex';
        return;
    }
    
    el.emptyState.style.display = 'none';
    
    // Sort tasks: pending first, then by priority level, then by ID desc
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    filtered.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        if (a.priority !== b.priority) {
            return priorityWeight[b.priority] - priorityWeight[a.priority];
        }
        return b.id - a.id;
    });

    filtered.forEach(todo => {
        const card = document.createElement('div');
        card.className = `task-card priority-${todo.priority} ${todo.completed ? 'completed' : ''}`;
        card.setAttribute('data-id', todo.id);
        
        // Custom tags HTML
        const tagsHtml = todo.tags.map(tag => `<span class="tag-label">#${tag}</span>`).join(' ');
        
        card.innerHTML = `
            <label class="checkbox-container">
                <input type="checkbox" ${todo.completed ? 'checked' : ''} class="task-checkbox">
                <span class="checkmark"></span>
            </label>
            <div class="task-details">
                <div class="task-text">${escapeHTML(todo.text)}</div>
                <div class="task-meta">
                    <span class="badge badge-${todo.priority}">${todo.priority}</span>
                    ${tagsHtml}
                </div>
            </div>
            <div class="task-actions">
                <button class="task-btn edit" title="Edit Task Name">
                    <svg class="icon" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="task-btn delete" title="Delete Task">
                    <svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;
        
        // Attach interactive event listeners to card elements
        const checkbox = card.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => toggleTodoStatus(todo.id, checkbox.checked, 'GUI'));
        
        const deleteBtn = card.querySelector('.task-btn.delete');
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id, 'GUI'));
        
        const editBtn = card.querySelector('.task-btn.edit');
        editBtn.addEventListener('click', () => startEditingTask(card, todo));
        
        // Support double click text to edit
        const textElement = card.querySelector('.task-text');
        textElement.addEventListener('dblclick', () => startEditingTask(card, todo));
        
        el.taskList.appendChild(card);
    });
}

function startEditingTask(card, todo) {
    const textElement = card.querySelector('.task-text');
    if (card.classList.contains('editing')) return;
    
    card.classList.add('editing');
    const originalText = todo.text;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = originalText;
    
    textElement.replaceWith(input);
    input.focus();
    input.select();
    
    const finishEdit = (save) => {
        if (!card.classList.contains('editing')) return;
        card.classList.remove('editing');
        
        const newText = input.value.trim();
        if (save && newText && newText !== originalText) {
            editTodoText(todo.id, newText, 'GUI');
        } else {
            // Restore original text
            input.replaceWith(textElement);
        }
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(true);
        if (e.key === 'Escape') finishEdit(false);
    });
    
    input.addEventListener('blur', () => {
        finishEdit(true);
    });
}

// --- 6. CORE ACTIONS (STATE WRITING) ---
function addTodo(text, priority = 'medium', tags = [], origin = 'SYSTEM') {
    if (!text.trim()) return null;
    
    const newTodo = {
        id: state.todos.length > 0 ? Math.max(...state.todos.map(t => t.id)) + 1 : 1,
        text: text.trim(),
        completed: false,
        priority: priority.toLowerCase(),
        tags: tags.map(t => t.trim().toLowerCase()).filter(Boolean),
        createdAt: Date.now()
    };
    
    state.todos.push(newTodo);
    saveToLocalStorage();
    renderAll();
    
    logToTerminal(`[${origin}] Task added successfully: ID ${newTodo.id} - "${newTodo.text}" [Priority: ${newTodo.priority}]`, "success");
    return newTodo;
}

function toggleTodoStatus(id, completed, origin = 'SYSTEM') {
    const todo = state.todos.find(t => t.id === id);
    if (!todo) {
        logToTerminal(`Task ID ${id} not found.`, "error");
        return;
    }
    
    todo.completed = completed;
    saveToLocalStorage();
    renderAll();
    
    const statusText = completed ? "COMPLETED" : "PENDING";
    logToTerminal(`[${origin}] Task ID ${id} marked ${statusText}: "${todo.text}"`, completed ? "success" : "info");
}

function editTodoText(id, newText, origin = 'SYSTEM') {
    const todo = state.todos.find(t => t.id === id);
    if (!todo) {
        logToTerminal(`Task ID ${id} not found.`, "error");
        return;
    }
    
    const oldText = todo.text;
    todo.text = newText.trim();
    saveToLocalStorage();
    renderAll();
    
    logToTerminal(`[${origin}] Renamed Task ${id} from "${oldText}" to "${newText}"`, "success");
}

function deleteTodo(id, origin = 'SYSTEM') {
    const todoIndex = state.todos.findIndex(t => t.id === id);
    if (todoIndex === -1) {
        logToTerminal(`Task ID ${id} not found.`, "error");
        return;
    }
    
    const deletedTodo = state.todos[todoIndex];
    state.todos.splice(todoIndex, 1);
    saveToLocalStorage();
    renderAll();
    
    logToTerminal(`[${origin}] Deleted Task ID ${id}: "${deletedTodo.text}"`, "info");
}

function clearTodos(onlyCompleted = true, origin = 'SYSTEM') {
    const initialCount = state.todos.length;
    if (onlyCompleted) {
        state.todos = state.todos.filter(t => !t.completed);
    } else {
        state.todos = [];
    }
    
    const deletedCount = initialCount - state.todos.length;
    saveToLocalStorage();
    renderAll();
    
    logToTerminal(`[${origin}] Cleared ${deletedCount} tasks.`, "info");
}

// --- 7. TERMINAL SHELL & CLI ENGINE ---
function logToTerminal(text, type = 'normal') {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    
    // Format text tags with custom styling tags if desired, or keep raw text
    line.textContent = text;
    
    // In case we want HTML structures (like tables) we check if the parameter starts with HTML
    if (text.startsWith('<')) {
        line.innerHTML = text;
    }
    
    el.terminalOutput.appendChild(line);
    scrollToBottom();
}

function scrollToBottom() {
    el.terminalBody.scrollTop = el.terminalBody.scrollHeight;
}

// CLI Command Parser
function executeCommand(cmdStr) {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;
    
    // Save to command history
    state.history.push(cmdStr);
    if (state.history.length > 50) state.history.shift(); // Cap history
    state.historyIndex = state.history.length;
    saveToLocalStorage();
    
    // Echo the command typed
    logToTerminal(`guest@termitodo:~$ ${cmdStr}`, 'cmd-echo');
    
    // Tokenize command string, keeping quoted strings as single arguments
    const tokens = parseCommandTokens(trimmed);
    const mainCommand = tokens[0].toLowerCase();
    
    if (mainCommand === 'help' || (mainCommand === 'todo' && tokens[1] === 'help')) {
        showHelp();
        return;
    }
    
    if (mainCommand === 'clear') {
        el.terminalOutput.innerHTML = '';
        return;
    }
    
    if (mainCommand === 'theme') {
        handleThemeCommand(tokens);
        return;
    }
    
    // To-Do Command Subtree
    if (mainCommand === 'todo') {
        const subCmd = tokens[1] ? tokens[1].toLowerCase() : 'list';
        
        switch (subCmd) {
            case 'add':
                handleTodoAdd(tokens.slice(2));
                break;
            case 'list':
                handleTodoList(tokens.slice(2));
                break;
            case 'done':
            case 'complete':
                handleTodoDone(tokens.slice(2), true);
                break;
            case 'undo':
            case 'pending':
                handleTodoDone(tokens.slice(2), false);
                break;
            case 'edit':
            case 'rename':
                handleTodoEdit(tokens.slice(2));
                break;
            case 'delete':
            case 'remove':
                handleTodoDelete(tokens.slice(2));
                break;
            case 'search':
                handleTodoSearch(tokens.slice(2));
                break;
            case 'clear':
                handleTodoClear(tokens.slice(2));
                break;
            case 'export':
            case 'download':
                exportBackup();
                break;
            case 'import':
            case 'upload':
                el.importFileInput.click();
                logToTerminal("Opening file selector...", "info");
                break;
            default:
                logToTerminal(`Unknown subcommand: 'todo ${subCmd}'. Type 'help' for instructions.`, "error");
        }
        return;
    }
    
    logToTerminal(`Command not found: '${mainCommand}'. Type 'help' for list of instructions.`, "error");
}

// Tokenizer that respects quote groupings (e.g. todo add "Go to store" --priority high)
function parseCommandTokens(cmdStr) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < cmdStr.length; i++) {
        const char = cmdStr[i];
        
        if ((char === '"' || char === "'") && (i === 0 || cmdStr[i-1] !== '\\')) {
            if (inQuotes && quoteChar === char) {
                inQuotes = false;
                // Keep the token grouping even if empty
                tokens.push(current);
                current = '';
            } else if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else {
                current += char;
            }
        } else if (char === ' ' && !inQuotes) {
            if (current !== '') {
                tokens.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }
    if (current !== '') {
        tokens.push(current);
    }
    return tokens.filter(t => t !== '');
}

// CLI HANDLERS
function showHelp() {
    logToTerminal(`
===================================================
TERMITODO COMMAND REFERENCE ENGINE v1.0.0
===================================================
Core Commands:
  help                       Show this manual
  clear                      Clear terminal screen
  theme <theme-name>         Switch aesthetic theme (matrix, cyberpunk, dracula, synthwave, slate)
  theme list                 List all available themes

Todo Management Commands:
  todo add "Text" [--priority <high|medium|low>] [--tags <tag1,tag2>]
                             Create a new to-do task card
  todo list                  List all tasks in a table format
    Flags:
      --priority <level>     Filter output by priority
      --status <done|active> Filter output by completion status
  todo done <id>             Mark a task as completed
  todo undo <id>             Mark a task as pending
  todo edit <id> "New Text"  Rename an existing task
  todo delete <id>           Delete a task permanently
  todo search <query>        Search text or tags
  todo clear [--all]         Clear completed tasks. Use --all to clear everything
  todo export                Save todo list to a 'todo.json' file
  todo import                Load tasks from a local 'todo.json' file
===================================================
`, "info");
}

function handleThemeCommand(tokens) {
    const sub = tokens[1] ? tokens[1].toLowerCase() : '';
    if (!sub) {
        logToTerminal("Usage: theme <theme-name>  |  theme list", "error");
        return;
    }
    
    if (sub === 'list') {
        logToTerminal(`Available themes: ${Themes.join(', ')}`, 'info');
        return;
    }
    
    if (Themes.includes(sub)) {
        setTheme(sub);
        el.themeSelect.value = sub;
        logToTerminal(`Theme switched to '${sub}'`, 'success');
    } else {
        logToTerminal(`Theme '${sub}' not recognized. Available: ${Themes.join(', ')}`, 'error');
    }
}

function setTheme(themeName) {
    Themes.forEach(t => el.body.classList.remove(`theme-${t}`));
    el.body.classList.add(`theme-${themeName}`);
    localStorage.setItem('termitodo_theme', themeName);
}

function handleTodoAdd(args) {
    if (args.length === 0) {
        logToTerminal("Usage: todo add \"Task Text\" [--priority high|medium|low] [--tags word,word]", "error");
        return;
    }
    
    const taskText = args[0];
    let priority = 'medium';
    let tags = [];
    
    // Parse flags
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--priority' && args[i+1]) {
            priority = args[i+1].toLowerCase();
            i++;
        } else if (args[i] === '--tags' && args[i+1]) {
            tags = args[i+1].split(',');
            i++;
        }
    }
    
    addTodo(taskText, priority, tags, 'CLI');
}

function handleTodoList(args) {
    let priorityFilter = null;
    let statusFilter = null;
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--priority' && args[i+1]) {
            priorityFilter = args[i+1].toLowerCase();
            i++;
        } else if (args[i] === '--status' && args[i+1]) {
            statusFilter = args[i+1].toLowerCase();
            i++;
        }
    }
    
    let filtered = state.todos;
    if (priorityFilter) {
        filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    if (statusFilter) {
        const targetVal = (statusFilter === 'done' || statusFilter === 'completed');
        filtered = filtered.filter(t => t.completed === targetVal);
    }
    
    if (filtered.length === 0) {
        logToTerminal("No tasks matched search criteria.", "info");
        return;
    }
    
    // Render a text-based ASCII table in the terminal!
    let tableHtml = `<div class="shell-table">
        <div class="shell-row header">
            <div class="shell-cell" style="width: 50px;">ID</div>
            <div class="shell-cell">Task Description</div>
            <div class="shell-cell" style="width: 100px;">Priority</div>
            <div class="shell-cell" style="width: 80px;">Status</div>
            <div class="shell-cell">Tags</div>
        </div>`;
        
    filtered.forEach(todo => {
        const statusSymbol = todo.completed ? '✔ DONE' : '⌛ PND';
        const tagsJoined = todo.tags.map(t => `#${t}`).join(', ') || '-';
        tableHtml += `
        <div class="shell-row ${todo.completed ? 'completed-task' : ''}">
            <div class="shell-cell">${todo.id}</div>
            <div class="shell-cell">${escapeHTML(todo.text)}</div>
            <div class="shell-cell"><span class="badge badge-${todo.priority}">${todo.priority}</span></div>
            <div class="shell-cell">${statusSymbol}</div>
            <div class="shell-cell" style="color: var(--text-muted); font-size: 0.8rem;">${escapeHTML(tagsJoined)}</div>
        </div>`;
    });
    
    tableHtml += `</div>`;
    logToTerminal(tableHtml, 'normal');
}

function handleTodoDone(args, markCompleted = true) {
    if (args.length === 0) {
        logToTerminal(`Usage: todo ${markCompleted ? 'done' : 'undo'} <task-id>`, "error");
        return;
    }
    const id = parseInt(args[0], 10);
    if (isNaN(id)) {
        logToTerminal("Error: ID must be a numeric integer.", "error");
        return;
    }
    toggleTodoStatus(id, markCompleted, 'CLI');
}

function handleTodoEdit(args) {
    if (args.length < 2) {
        logToTerminal("Usage: todo edit <task-id> \"New Task Text\"", "error");
        return;
    }
    const id = parseInt(args[0], 10);
    const newText = args[1];
    
    if (isNaN(id)) {
        logToTerminal("Error: ID must be a numeric integer.", "error");
        return;
    }
    if (!newText.trim()) {
        logToTerminal("Error: New text cannot be empty.", "error");
        return;
    }
    editTodoText(id, newText, 'CLI');
}

function handleTodoDelete(args) {
    if (args.length === 0) {
        logToTerminal("Usage: todo delete <task-id>", "error");
        return;
    }
    const id = parseInt(args[0], 10);
    if (isNaN(id)) {
        logToTerminal("Error: ID must be a numeric integer.", "error");
        return;
    }
    deleteTodo(id, 'CLI');
}

function handleTodoSearch(args) {
    if (args.length === 0) {
        logToTerminal("Usage: todo search <query>", "error");
        return;
    }
    const query = args.join(' ').toLowerCase();
    
    // Set search state on GUI to visually highlight
    state.currentSearch = query;
    el.guiSearchInput.value = query;
    renderTaskList();
    
    const results = state.todos.filter(t => 
        t.text.toLowerCase().includes(query) || 
        t.tags.some(tag => tag.toLowerCase().includes(query)) ||
        t.id.toString() === query
    );
    
    logToTerminal(`Found ${results.length} search matches in list:`, "info");
    if (results.length > 0) {
        handleTodoList([`--status`, `all`]); // prints matches table
    }
}

function handleTodoClear(args) {
    const clearAll = args.includes('--all');
    clearTodos(!clearAll, 'CLI');
}


// --- 8. FILE IMPORT / EXPORT PERSISTENCE ---
function exportBackup() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.todos, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `todo_backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        logToTerminal("[SYSTEM] Database backup exported successfully.", "success");
    } catch (e) {
        logToTerminal(`[SYSTEM] Export failed: ${e.message}`, "error");
    }
}

function importBackupFile(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            
            // Validation check
            if (!Array.isArray(parsed)) {
                throw new Error("Invalid schema: Backup must be a JSON array of tasks.");
            }
            
            // Validate schema items
            const cleanedList = [];
            let malformedCount = 0;
            
            parsed.forEach((item, index) => {
                if (item && typeof item === 'object' && typeof item.text === 'string') {
                    cleanedList.push({
                        id: typeof item.id === 'number' ? item.id : (index + 1),
                        text: item.text,
                        completed: !!item.completed,
                        priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
                        tags: Array.isArray(item.tags) ? item.tags.map(t => String(t).toLowerCase()) : [],
                        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
                    });
                } else {
                    malformedCount++;
                }
            });
            
            if (cleanedList.length === 0) {
                throw new Error("No valid tasks found in JSON file.");
            }
            
            // Merge/Overwrite prompt: we overwrite existing lists for this backup
            state.todos = cleanedList;
            saveToLocalStorage();
            renderAll();
            
            logToTerminal(`[SYSTEM] Imported ${cleanedList.length} tasks successfully. Overwrote active workspace database.`, "success");
            if (malformedCount > 0) {
                logToTerminal(`[SYSTEM] Skipped ${malformedCount} malformed object rows.`, "warning");
            }
        } catch (err) {
            logToTerminal(`[SYSTEM] Import failed: ${err.message}`, "error");
        }
    };
    reader.readAsText(file);
}


// --- 9. WINDOW INTERACTION EVENT LISTENERS ---
function setupEventListeners() {
    // Theme dropdown changes theme
    el.themeSelect.addEventListener('change', (e) => {
        setTheme(e.target.value);
        logToTerminal(`[GUI] Changed theme setting to: ${e.target.value}`, "info");
    });
    
    // CRT monitor toggle
    el.toggleCrtBtn.addEventListener('click', () => {
        state.crtActive = !state.crtActive;
        updateCrtState();
        saveToLocalStorage();
        logToTerminal(`[SYSTEM] Monitor retro CRT effects: ${state.crtActive ? 'ON' : 'OFF'}`, "info");
    });
    
    // Clear terminal screen button
    el.clearTermBtn.addEventListener('click', () => {
        el.terminalOutput.innerHTML = '';
    });
    
    // Clicking terminal body focuses terminal input
    el.terminalBody.addEventListener('click', (e) => {
        // Only focus if they didn't highlight or click an existing action/input
        if (window.getSelection().toString() === "" && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            el.terminalInput.focus();
        }
    });

    // Terminal Input events
    el.terminalInput.addEventListener('input', (e) => {
        const value = e.target.value;
        el.promptCommandDisplay.textContent = value;
        updateAutocompleteSuggestion(value);
    });
    
    el.terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = el.terminalInput.value;
            if (command.trim()) {
                executeCommand(command);
                el.terminalInput.value = '';
                el.promptCommandDisplay.textContent = '';
                el.autocompleteSuggestion.textContent = '';
            }
        }
        
        // Command History Navigation
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (state.historyIndex > 0) {
                state.historyIndex--;
                const val = state.history[state.historyIndex];
                el.terminalInput.value = val;
                el.promptCommandDisplay.textContent = val;
                updateAutocompleteSuggestion(val);
            }
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (state.historyIndex < state.history.length - 1) {
                state.historyIndex++;
                const val = state.history[state.historyIndex];
                el.terminalInput.value = val;
                el.promptCommandDisplay.textContent = val;
                updateAutocompleteSuggestion(val);
            } else {
                state.historyIndex = state.history.length;
                el.terminalInput.value = '';
                el.promptCommandDisplay.textContent = '';
                el.autocompleteSuggestion.textContent = '';
            }
        }
        
        // Autocomplete with Tab key
        if (e.key === 'Tab') {
            e.preventDefault();
            const suggestion = el.autocompleteSuggestion.textContent;
            if (suggestion) {
                // Complete the text
                const currentVal = el.terminalInput.value;
                el.terminalInput.value = currentVal + suggestion;
                el.promptCommandDisplay.textContent = el.terminalInput.value;
                el.autocompleteSuggestion.textContent = '';
            }
        }
    });

    // Export button click
    el.exportBtn.addEventListener('click', () => {
        exportBackup();
    });
    
    // Import button click (triggers hidden upload element)
    el.importBtnTrigger.addEventListener('click', () => {
        el.importFileInput.click();
    });
    
    el.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importBackupFile(e.target.files[0]);
            e.target.value = ''; // clear
        }
    });
    
    // Search Box key input
    el.guiSearchInput.addEventListener('input', (e) => {
        state.currentSearch = e.target.value;
        renderTaskList();
    });
    
    // Filtering pill buttons
    el.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            el.filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            const filterVal = pill.getAttribute('data-filter');
            state.currentFilter = filterVal;
            renderTaskList();
            
            logToTerminal(`[GUI] Applied list filter: ${filterVal.toUpperCase()}`, "info");
        });
    });
    
    // Quick Add task form submission
    el.quickAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = el.quickAddInput.value;
        const priority = el.quickAddPriority.value;
        const tags = el.quickAddTags.value.split(',').filter(Boolean);
        
        if (text.trim()) {
            addTodo(text, priority, tags, 'GUI');
            el.quickAddInput.value = '';
            el.quickAddTags.value = '';
            el.terminalInput.focus();
        }
    });
    
    // Drag and drop JSON file persistence support
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.taskList.classList.add('drag-over');
    });
    
    window.addEventListener('dragleave', () => {
        el.taskList.classList.remove('drag-over');
    });
    
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        el.taskList.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === "application/json" || file.name.endsWith('.json')) {
                importBackupFile(file);
            } else {
                logToTerminal("[SYSTEM] Error: Uploaded file must be a .json task archive.", "error");
            }
        }
    });
}

function updateCrtState() {
    if (state.crtActive) {
        el.crtOverlay.classList.add('active');
        el.toggleCrtBtn.classList.add('active');
        document.querySelector('.terminal-panel').classList.add('crt-active');
    } else {
        el.crtOverlay.classList.remove('active');
        el.toggleCrtBtn.classList.remove('active');
        document.querySelector('.terminal-panel').classList.remove('crt-active');
    }
}

// --- 10. AUTOCOMPLETE HELPERS ---
const AUTOCOMPLETE_COMMANDS = [
    'help', 'clear', 'theme ', 'theme list', 'theme cyberpunk', 'theme matrix', 'theme dracula', 'theme synthwave', 'theme slate',
    'todo add ', 'todo list', 'todo done ', 'todo complete ', 'todo undo ', 'todo pending ', 'todo edit ', 'todo rename ', 'todo delete ', 'todo remove ', 'todo search ', 'todo clear', 'todo clear --all', 'todo export', 'todo import'
];

function updateAutocompleteSuggestion(inputVal) {
    if (!inputVal) {
        el.autocompleteSuggestion.textContent = '';
        return;
    }
    
    // Find matching command prefix
    const match = AUTOCOMPLETE_COMMANDS.find(cmd => cmd.toLowerCase().startsWith(inputVal.toLowerCase()));
    if (match && match.toLowerCase() !== inputVal.toLowerCase()) {
        // Return only the remainder string
        const remainder = match.slice(inputVal.length);
        el.autocompleteSuggestion.textContent = remainder;
    } else {
        el.autocompleteSuggestion.textContent = '';
    }
}

// --- 11. UTILITIES ---
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function updateClock() {
    const now = new Date();
    el.clockDisplay.textContent = now.toLocaleTimeString();
}

// Start execution
window.addEventListener('DOMContentLoaded', init);
