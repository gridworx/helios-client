import { useState, useRef, useEffect } from 'react';
import { HelpCircle, BookOpen, Trash2, X } from 'lucide-react';
import './DeveloperConsole.css';

interface ConsoleOutput {
  type: 'command' | 'success' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

interface DeveloperConsoleProps {
  organizationId: string;
}

export function DeveloperConsole({ organizationId }: DeveloperConsoleProps) {
  const [output, setOutput] = useState<ConsoleOutput[]>([
    {
      type: 'info',
      content: 'Helios Developer Console v1.0.0',
      timestamp: new Date()
    },
    {
      type: 'info',
      content: 'Type "help" for available commands or "examples" for usage examples.',
      timestamp: new Date()
    }
  ]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addOutput = (type: ConsoleOutput['type'], content: string) => {
    setOutput(prev => [...prev, { type, content, timestamp: new Date() }]);
  };

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getToken = (): string | null => {
    return localStorage.getItem('helios_token');
  };

  const getOrganizationId = (): string | null => {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.organizationId || organizationId;
    } catch {
      return organizationId;
    }
  };

  const apiRequest = async (method: string, path: string, body?: any): Promise<any> => {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`http://localhost:3001${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    // Handle empty responses (like DELETE 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return null; // No content to parse
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }
    return data;
  };

  const executeCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Add command to output
    addOutput('command', `$ ${trimmedCommand}`);

    // Add to history
    setCommandHistory(prev => [...prev, trimmedCommand]);
    setHistoryIndex(-1);

    setIsExecuting(true);

    try {
      // Handle built-in commands
      if (trimmedCommand === 'help') {
        showHelp();
      } else if (trimmedCommand === 'examples') {
        showExamples();
      } else if (trimmedCommand === 'clear') {
        setOutput([]);
      } else {
        // Auto-prepend "helios" if command starts with a known module
        const knownModules = ['api', 'gw', 'google-workspace', 'users', 'groups', 'ms', 'microsoft'];
        const firstWord = trimmedCommand.split(' ')[0];

        let commandToExecute = trimmedCommand;
        if (!trimmedCommand.startsWith('helios ') && knownModules.includes(firstWord)) {
          commandToExecute = `helios ${trimmedCommand}`;
        }

        if (commandToExecute.startsWith('helios ')) {
          await executeHeliosCommand(commandToExecute);
        } else {
          addOutput('error', `Unknown command: ${trimmedCommand}. Type "help" for available commands.`);
        }
      }
    } catch (error: any) {
      addOutput('error', `Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
      // Re-focus input after command completes
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const executeHeliosCommand = async (command: string) => {
    try {
      // Parse command: helios <module> <resource> <action> [args]
      const parts = command.split(' ').filter(p => p);
      parts.shift(); // Remove 'helios'

      if (parts.length === 0) {
        addOutput('error', 'Usage: helios <module> <resource> <action> [options]');
        return;
      }

      const module = parts[0];

      // Route to appropriate handler
      switch (module) {
        case 'api':
          await handleApiCommand(parts.slice(1));
          break;
        case 'gw':
        case 'google-workspace':
          await handleGoogleWorkspaceCommand(parts.slice(1));
          break;
        case 'm365':
        case 'microsoft-365':
          await handleMicrosoft365Command(parts.slice(1));
          break;
        case 'users':
          await handleUsersCommand(parts.slice(1));
          break;
        case 'groups':
          await handleGroupsCommand(parts.slice(1));
          break;
        default:
          addOutput('error', `Unknown module: ${module}. Use: api, gw, m365, users, or groups`);
      }
    } catch (error: any) {
      addOutput('error', `Command failed: ${error.message}`);
    }
  };

  // ===== API COMMAND HANDLER =====
  const handleApiCommand = async (args: string[]) => {
    if (args.length < 2) {
      addOutput('error', 'Usage: helios api <METHOD> <PATH> [JSON_BODY]');
      return;
    }

    const method = args[0].toUpperCase();
    const path = args[1];
    const body = args[2] ? JSON.parse(args[2]) : undefined;

    const data = await apiRequest(method, path, body);
    addOutput('success', JSON.stringify(data, null, 2));
  };

  // ===== GOOGLE WORKSPACE COMMAND HANDLER =====
  const handleGoogleWorkspaceCommand = async (args: string[]) => {
    if (args.length === 0) {
      addOutput('error', 'Usage: helios gw <resource> <action> [options]');
      addOutput('info', 'Resources: users, groups, orgunits, delegates, drive, shared-drives, sync');
      return;
    }

    const resource = args[0];
    const action = args[1] || 'list';
    const restArgs = args.slice(2);

    switch (resource) {
      case 'users':
        await handleGWUsers(action, restArgs);
        break;
      case 'groups':
        await handleGWGroups(action, restArgs);
        break;
      case 'orgunits':
        await handleGWOrgUnits(action, restArgs);
        break;
      case 'delegates':
        await handleGWDelegates(action, restArgs);
        break;
      case 'drive':
        await handleGWDrive(action, restArgs);
        break;
      case 'shared-drives':
        await handleGWSharedDrives(action, restArgs);
        break;
      case 'sync':
        await handleGWSync(action, restArgs);
        break;
      default:
        addOutput('error', `Unknown resource: ${resource}`);
    }
  };

  // ----- Google Workspace: Users -----
  const handleGWUsers = async (action: string, args: string[]) => {
    const orgId = getOrganizationId();

    switch (action) {
      case 'list': {
        const data = await apiRequest('GET', `/api/google-workspace/cached-users/${orgId}`);
        if (data.success && data.data?.users) {
          const users = data.data.users.map((u: any) => {
            const email = (u.email || u.primaryEmail || '').padEnd(30);
            // Try multiple field name variations
            const firstName = (u.givenName || u.given_name || u.name?.givenName || u.firstName || u.first_name || '').substring(0, 15).padEnd(15);
            const lastName = (u.familyName || u.family_name || u.name?.familyName || u.lastName || u.last_name || '').substring(0, 15).padEnd(15);
            const orgUnit = (u.orgUnitPath || u.org_unit_path || '/').substring(0, 25).padEnd(25);
            const status = (u.isSuspended || u.is_suspended || u.suspended) ? 'suspended' : 'active';
            return `${email} ${firstName} ${lastName} ${orgUnit} ${status}`;
          }).join('\n');
          addOutput('success', `\nEMAIL${' '.repeat(25)}FIRST NAME${' '.repeat(5)}LAST NAME${' '.repeat(6)}ORG UNIT${' '.repeat(17)}STATUS\n${'='.repeat(110)}\n${users}`);
        } else {
          addOutput('error', 'No users found or invalid response format');
        }
        break;
      }

      case 'get': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw users get <email> [--format=table|json] [--download]');
          return;
        }
        const params = parseArgs(args.slice(1));
        const format = params.format || 'table';
        const shouldDownload = params.download === 'true' || params.download === '';
        const email = args[0];
        const data = await apiRequest('GET', `/api/google/admin/directory/v1/users/${email}`);

        if (shouldDownload) {
          downloadJSON(data, `user-${email.replace('@', '-')}.json`);
          addOutput('success', `Downloaded user data to user-${email.replace('@', '-')}.json`);
        } else if (format === 'json') {
          addOutput('success', JSON.stringify(data, null, 2));
        } else {
          // Format as readable table
          const formatField = (label: string, value: any) => {
            return value ? `  ${label.padEnd(20)}: ${value}` : '';
          };

          const output = [
            '\nUser Details:',
            '='.repeat(80),
            formatField('Email', data.primaryEmail),
            formatField('Name', data.name?.fullName),
            formatField('First Name', data.name?.givenName),
            formatField('Last Name', data.name?.familyName),
            formatField('Organizational Unit', data.orgUnitPath),
            formatField('Status', data.suspended ? 'Suspended' : 'Active'),
            formatField('Admin', data.isAdmin ? 'Yes' : 'No'),
            formatField('Created', data.creationTime ? new Date(data.creationTime).toLocaleString() : ''),
            formatField('Last Login', data.lastLoginTime ? new Date(data.lastLoginTime).toLocaleString() : ''),
            formatField('Recovery Email', data.recoveryEmail),
            formatField('Recovery Phone', data.recoveryPhone),
            formatField('2SV Enrolled', data.isEnrolledIn2Sv ? 'Yes' : 'No'),
            formatField('Mailbox Setup', data.isMailboxSetup ? 'Yes' : 'No'),
            '='.repeat(80),
            '',
            'Use --format=json for full details'
          ].filter(line => line).join('\n');

          addOutput('success', output);
        }
        break;
      }

      case 'create': {
        if (args.length < 3) {
          addOutput('error', 'Usage: helios gw users create <email> --firstName=<name> --lastName=<name> --password=<pwd>');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        const body = {
          primaryEmail: email,
          name: {
            givenName: params.firstName,
            familyName: params.lastName
          },
          password: params.password,
          orgUnitPath: params.ou || '/',
          changePasswordAtNextLogin: params.changePassword !== 'false'
        };

        await apiRequest('POST', '/api/google/admin/directory/v1/users', body);
        addOutput('success', `User created: ${email}`);
        break;
      }

      case 'update': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw users update <email> --firstName=<name> --lastName=<name>');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        const body: any = {};
        if (params.firstName || params.lastName) {
          body.name = {
            givenName: params.firstName,
            familyName: params.lastName
          };
        }
        if (params.ou) body.orgUnitPath = params.ou;

        await apiRequest('PATCH', `/api/google/admin/directory/v1/users/${email}`, body);
        addOutput('success', `User updated: ${email}`);
        break;
      }

      case 'suspend': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw users suspend <email>');
          return;
        }
        const email = args[0];
        await apiRequest('PATCH', `/api/google/admin/directory/v1/users/${email}`, { suspended: true });
        addOutput('success', `User suspended: ${email}`);
        break;
      }

      case 'restore': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw users restore <email>');
          return;
        }
        const email = args[0];
        await apiRequest('PATCH', `/api/google/admin/directory/v1/users/${email}`, { suspended: false });
        addOutput('success', `User restored: ${email}`);
        break;
      }

      case 'delete': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw users delete <email>');
          return;
        }
        const email = args[0];
        await apiRequest('DELETE', `/api/google/admin/directory/v1/users/${email}`);
        addOutput('success', `User deleted: ${email}`);
        break;
      }

      case 'move': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw users move <email> --ou=</Staff/Sales>');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));
        await apiRequest('PATCH', `/api/google/admin/directory/v1/users/${email}`, { orgUnitPath: params.ou });
        addOutput('success', `User moved to ${params.ou}: ${email}`);
        break;
      }

      case 'groups': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw users groups <email>');
          return;
        }
        const email = args[0];
        const data = await apiRequest('GET', `/api/google/admin/directory/v1/groups?userKey=${email}`);
        if (data.groups) {
          const groups = data.groups.map((g: any) => `${g.email.padEnd(40)} ${g.name}`).join('\n');
          addOutput('success', `\nGroups for ${email}:\n${groups}`);
        } else {
          addOutput('info', `No groups found for ${email}`);
        }
        break;
      }

      case 'reset-password': {
        if (args.length === 0) {
          addOutput('error', 'Usage: gw users reset-password <email> [--password=X]');
          addOutput('info', 'If password not provided, a random one will be generated');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        // Generate random password if not provided
        const generatePassword = () => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
          let password = '';
          for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return password;
        };

        const password = params.password || generatePassword();

        await apiRequest('PATCH', `/api/google/admin/directory/v1/users/${email}`, {
          password: password
        });

        addOutput('success', `[OK]Password reset for ${email}`);
        if (!params.password) {
          addOutput('info', `[KEY]Generated password: ${password}`);
          addOutput('info', '[INFO]User will be prompted to change on first login');
        }
        break;
      }

      case 'add-alias': {
        if (args.length < 2) {
          addOutput('error', 'Usage: gw users add-alias <email> <alias>');
          addOutput('info', 'Example: gw users add-alias john@company.com johnny@company.com');
          return;
        }
        const email = args[0];
        const alias = args[1];

        await apiRequest('POST', `/api/google/admin/directory/v1/users/${email}/aliases`, {
          alias: alias
        });

        addOutput('success', `[OK]Added alias ${alias} to ${email}`);
        break;
      }

      case 'remove-alias': {
        if (args.length < 2) {
          addOutput('error', 'Usage: gw users remove-alias <email> <alias>');
          return;
        }
        const email = args[0];
        const alias = args[1];

        await apiRequest('DELETE', `/api/google/admin/directory/v1/users/${email}/aliases/${alias}`);

        addOutput('success', `[OK]Removed alias ${alias} from ${email}`);
        break;
      }

      case 'make-admin': {
        if (args.length === 0) {
          addOutput('error', 'Usage: gw users make-admin <email>');
          return;
        }
        const email = args[0];

        await apiRequest('POST', `/api/google/admin/directory/v1/users/${email}/makeAdmin`, {
          status: true
        });

        addOutput('success', `[OK]Granted super admin privileges to ${email}`);
        addOutput('info', '[WARN]User now has full administrative access to the organization');
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: list, get, create, update, suspend, restore, delete, move, groups, reset-password, add-alias, remove-alias, make-admin`);
    }
  };

  // ----- Google Workspace: Groups -----
  const handleGWGroups = async (action: string, args: string[]) => {
    const orgId = getOrganizationId();

    switch (action) {
      case 'list': {
        const data = await apiRequest('GET', `/api/google-workspace/groups/${orgId}`);
        if (data.success && data.data?.groups) {
          const groups = data.data.groups.map((g: any) => {
            const email = (g.email || '').padEnd(40);
            const name = (g.name || '').padEnd(30);
            const members = (g.directMembersCount || 0).toString().padStart(7);
            return `${email} ${name} ${members}`;
          }).join('\n');
          addOutput('success', `\nEMAIL${' '.repeat(35)}NAME${' '.repeat(26)}MEMBERS\n${'='.repeat(85)}\n${groups}`);
        }
        break;
      }

      case 'get': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw groups get <group-email> [--format=table|json]');
          return;
        }
        const params = parseArgs(args.slice(1));
        const format = params.format || 'table';
        const groupEmail = args[0];
        const data = await apiRequest('GET', `/api/google/admin/directory/v1/groups/${groupEmail}`);

        if (format === 'json') {
          addOutput('success', JSON.stringify(data, null, 2));
        } else {
          // Format as readable table
          const formatField = (label: string, value: any) => {
            return value ? `  ${label.padEnd(20)}: ${value}` : '';
          };

          const output = [
            '\nGroup Details:',
            '='.repeat(80),
            formatField('Email', data.email),
            formatField('Name', data.name),
            formatField('Description', data.description),
            formatField('Direct Members', data.directMembersCount),
            formatField('Admin Created', data.adminCreated ? 'Yes' : 'No'),
            formatField('Group ID', data.id),
            '='.repeat(80),
            '',
            'Use --format=json for full details'
          ].filter(line => line).join('\n');

          addOutput('success', output);
        }
        break;
      }

      case 'create': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw groups create <email> --name="Group Name" [--description="..."]');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        const body = {
          email,
          name: params.name,
          description: params.description || ''
        };

        await apiRequest('POST', '/api/google-workspace/groups', { organizationId: orgId, ...body });
        addOutput('success', `Group created: ${email}`);
        break;
      }

      case 'update': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw groups update <group-email> --name="New Name" [--description="..."]');
          return;
        }
        const groupEmail = args[0];
        const params = parseArgs(args.slice(1));

        const body: any = {};
        if (params.name) body.name = params.name;
        if (params.description) body.description = params.description;

        await apiRequest('PATCH', `/api/google-workspace/groups/${groupEmail}`, { organizationId: orgId, ...body });
        addOutput('success', `Group updated: ${groupEmail}`);
        break;
      }

      case 'delete': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw groups delete <group-email>');
          return;
        }
        const groupEmail = args[0];
        await apiRequest('DELETE', `/api/google/admin/directory/v1/groups/${groupEmail}`);
        addOutput('success', `Group deleted: ${groupEmail}`);
        break;
      }

      case 'members': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw groups members <group-email>');
          return;
        }
        const groupEmail = args[0];
        const data = await apiRequest('GET', `/api/google-workspace/groups/${groupEmail}/members?organizationId=${orgId}`);
        if (data.success && data.data?.members) {
          const members = data.data.members.map((m: any) => {
            const email = (m.email || '').padEnd(40);
            const role = (m.role || 'MEMBER').padEnd(10);
            const status = m.status || 'ACTIVE';
            return `${email} ${role} ${status}`;
          }).join('\n');
          addOutput('success', `\nMembers of ${groupEmail}:\n\nEMAIL${' '.repeat(35)}ROLE${' '.repeat(6)}STATUS\n${'='.repeat(60)}\n${members}`);
        } else {
          addOutput('info', `No members in group ${groupEmail}`);
        }
        break;
      }

      case 'add-member': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw groups add-member <group-email> <user-email> [--role=MEMBER|MANAGER|OWNER]');
          return;
        }
        const groupEmail = args[0];
        const userEmail = args[1];
        const params = parseArgs(args.slice(2));
        const role = params.role || 'MEMBER';

        await apiRequest('POST', `/api/google-workspace/groups/${groupEmail}/members`, {
          organizationId: orgId,
          email: userEmail,
          role
        });
        addOutput('success', `Added ${userEmail} to ${groupEmail} as ${role}`);
        break;
      }

      case 'remove-member': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw groups remove-member <group-email> <user-email>');
          return;
        }
        const groupEmail = args[0];
        const userEmail = args[1];

        await apiRequest('DELETE', `/api/google-workspace/groups/${groupEmail}/members/${userEmail}?organizationId=${orgId}`);
        addOutput('success', `Removed ${userEmail} from ${groupEmail}`);
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: list, get, create, update, delete, members, add-member, remove-member`);
    }
  };

  // ----- Google Workspace: Organizational Units -----
  const handleGWOrgUnits = async (action: string, args: string[]) => {
    const orgId = getOrganizationId();

    switch (action) {
      case 'list': {
        const data = await apiRequest('GET', `/api/google-workspace/org-units/${orgId}`);
        if (data.success && data.data?.orgUnits) {
          const ous = data.data.orgUnits.map((ou: any) => {
            const path = (ou.path || '').padEnd(40);
            const name = (ou.name || '').padEnd(30);
            const users = (ou.userCount || 0).toString().padStart(6);
            return `${path} ${name} ${users}`;
          }).join('\n');
          addOutput('success', `\nPATH${' '.repeat(36)}NAME${' '.repeat(26)}USERS\n${'='.repeat(82)}\n${ous}`);
        }
        break;
      }

      case 'get': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw orgunits get </Staff/Sales>');
          return;
        }
        const ouPath = args[0];
        const data = await apiRequest('GET', `/api/google/admin/directory/v1/customer/my_customer/orgunits${ouPath}`);
        addOutput('success', JSON.stringify(data, null, 2));
        break;
      }

      case 'create': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw orgunits create <parentPath> --name="Sales" [--description="..."]');
          return;
        }
        const parentPath = args[0];
        const params = parseArgs(args.slice(1));

        const body = {
          name: params.name,
          parentOrgUnitPath: parentPath,
          description: params.description || ''
        };

        await apiRequest('POST', '/api/google/admin/directory/v1/customer/my_customer/orgunits', body);
        addOutput('success', `OU created: ${parentPath}/${params.name}`);
        break;
      }

      case 'update': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw orgunits update </Staff/Sales> --name="New Name"');
          return;
        }
        const ouPath = args[0];
        const params = parseArgs(args.slice(1));

        const body: any = {};
        if (params.name) body.name = params.name;
        if (params.description) body.description = params.description;

        await apiRequest('PUT', `/api/google/admin/directory/v1/customer/my_customer/orgunits${ouPath}`, body);
        addOutput('success', `OU updated: ${ouPath}`);
        break;
      }

      case 'delete': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw orgunits delete </Staff/Sales>');
          return;
        }
        const ouPath = args[0];
        await apiRequest('DELETE', `/api/google/admin/directory/v1/customer/my_customer/orgunits${ouPath}`);
        addOutput('success', `OU deleted: ${ouPath}`);
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: list, get, create, update, delete`);
    }
  };

  // ----- Google Workspace: Email Delegation -----
  const handleGWDelegates = async (action: string, args: string[]) => {
    switch (action) {
      case 'list': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios gw delegates list <user-email>');
          return;
        }
        const userEmail = args[0];
        const data = await apiRequest('GET', `/api/google/gmail/v1/users/${userEmail}/settings/delegates`);
        if (data.delegates) {
          const delegates = data.delegates.map((d: any) => d.delegateEmail).join('\n');
          addOutput('success', `\nDelegates for ${userEmail}:\n${delegates}`);
        } else {
          addOutput('info', `No delegates found for ${userEmail}`);
        }
        break;
      }

      case 'add': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw delegates add <user-email> <delegate-email>');
          return;
        }
        const userEmail = args[0];
        const delegateEmail = args[1];

        const body = {
          delegateEmail: delegateEmail
        };

        await apiRequest('POST', `/api/google/gmail/v1/users/${userEmail}/settings/delegates`, body);
        addOutput('success', `Added delegate ${delegateEmail} for ${userEmail}`);
        break;
      }

      case 'remove': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios gw delegates remove <user-email> <delegate-email>');
          return;
        }
        const userEmail = args[0];
        const delegateEmail = args[1];

        await apiRequest('DELETE', `/api/google/gmail/v1/users/${userEmail}/settings/delegates/${delegateEmail}`);
        addOutput('success', `Removed delegate ${delegateEmail} from ${userEmail}`);
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: list, add, remove`);
    }
  };

  // ----- Google Workspace: Sync -----
  const handleGWSync = async (action: string, _args: string[]) => {
    const orgId = getOrganizationId();

    switch (action) {
      case 'users': {
        const _data = await apiRequest('POST', '/api/google-workspace/sync-now', { organizationId: orgId });
        addOutput('success', `User sync completed: ${JSON.stringify(_data)}`);
        break;
      }

      case 'groups': {
        const data = await apiRequest('POST', '/api/google-workspace/sync-groups', { organizationId: orgId });
        addOutput('success', `Groups sync completed: ${JSON.stringify(data)}`);
        break;
      }

      case 'orgunits': {
        const data = await apiRequest('POST', '/api/google-workspace/sync-org-units', { organizationId: orgId });
        addOutput('success', `OU sync completed: ${JSON.stringify(data)}`);
        break;
      }

      case 'all': {
        addOutput('info', 'Starting full sync...');
        const users = await apiRequest('POST', '/api/google-workspace/sync-now', { organizationId: orgId });
        const groups = await apiRequest('POST', '/api/google-workspace/sync-groups', { organizationId: orgId });
        const ous = await apiRequest('POST', '/api/google-workspace/sync-org-units', { organizationId: orgId });
        addOutput('success', `Full sync completed:\nUsers: ${JSON.stringify(users)}\nGroups: ${JSON.stringify(groups)}\nOUs: ${JSON.stringify(ous)}`);
        break;
      }

      default:
        addOutput('error', `Unknown sync target: ${action}. Use: users, groups, orgunits, all`);
    }
  };

  // ----- Google Workspace: Drive -----
  const handleGWDrive = async (action: string, args: string[]) => {
    switch (action) {
      case 'transfer-ownership': {
        if (args.length < 2) {
          addOutput('error', 'Usage: gw drive transfer-ownership <from-email> <to-email>');
          addOutput('info', 'Transfers all Drive files from one user to another');
          addOutput('info', '[WARN]This operation may take several minutes for large file collections');
          return;
        }
        const fromEmail = args[0];
        const toEmail = args[1];

        addOutput('info', `[SYNC]Initiating Drive ownership transfer...`);
        addOutput('info', `   From: ${fromEmail}`);
        addOutput('info', `   To: ${toEmail}`);
        addOutput('info', '');

        try {
          // Step 1: Get all files owned by fromEmail
          addOutput('info', '[STEP]Step 1/2: Finding files...');
          const files = await apiRequest('GET', '/api/google/drive/v3/files', {
            q: `'${fromEmail}' in owners and trashed=false`,
            fields: 'files(id,name,owners)',
            pageSize: 1000
          });

          if (!files.files || files.files.length === 0) {
            addOutput('info', `[OK]No files found owned by ${fromEmail}`);
            return;
          }

          addOutput('success', `   Found ${files.files.length} files to transfer`);
          addOutput('info', '');

          // Step 2: Transfer each file
          addOutput('info', `[STEP]Step 2/2: Transferring ownership...`);
          let transferred = 0;
          let errors = 0;

          for (const file of files.files) {
            try {
              await apiRequest('POST', `/api/google/drive/v3/files/${file.id}/permissions`, {
                role: 'owner',
                type: 'user',
                emailAddress: toEmail,
                transferOwnership: true
              });
              transferred++;

              if (transferred % 10 === 0) {
                addOutput('info', `   Progress: ${transferred}/${files.files.length} files...`);
              }
            } catch (error: any) {
              errors++;
              addOutput('error', `   Failed to transfer: ${file.name} - ${error.message}`);
            }
          }

          addOutput('info', '');
          addOutput('success', `[OK]Transfer complete!`);
          addOutput('success', `   Transferred: ${transferred} files`);
          if (errors > 0) {
            addOutput('error', `   Errors: ${errors} files (check permissions)`);
          }

        } catch (error: any) {
          addOutput('error', `Transfer failed: ${error.message}`);
        }
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: transfer-ownership`);
    }
  };

  // ----- Google Workspace: Shared Drives -----
  const handleGWSharedDrives = async (action: string, args: string[]) => {
    switch (action) {
      case 'create': {
        const params = parseArgs(args);
        if (!params.name) {
          addOutput('error', 'Usage: gw shared-drives create --name="Marketing Team"');
          addOutput('info', 'Creates a new shared drive for team collaboration');
          return;
        }

        // Generate unique request ID
        const requestId = `helios-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const data = await apiRequest('POST', '/api/google/drive/v3/drives', {
          requestId: requestId,
          name: params.name
        });

        addOutput('success', `[OK]Created shared drive: ${params.name}`);
        addOutput('info', `   Drive ID: ${data.id}`);
        break;
      }

      case 'list': {
        const data = await apiRequest('GET', '/api/google/drive/v3/drives', {
          pageSize: 100
        });

        if (data.drives && data.drives.length > 0) {
          const drives = data.drives.map((d: any) => {
            const name = (d.name || '').substring(0, 40).padEnd(40);
            const id = (d.id || '').substring(0, 30);
            return `${name} ${id}`;
          }).join('\n');
          addOutput('success', `\nNAME${' '.repeat(36)}DRIVE ID\n${'='.repeat(75)}\n${drives}`);
          addOutput('info', `\nTotal: ${data.drives.length} shared drives`);
        } else {
          addOutput('info', 'No shared drives found');
        }
        break;
      }

      case 'get': {
        if (args.length === 0) {
          addOutput('error', 'Usage: gw shared-drives get <drive-id>');
          return;
        }
        const driveId = args[0];

        const data = await apiRequest('GET', `/api/google/drive/v3/drives/${driveId}`);
        addOutput('success', JSON.stringify(data, null, 2));
        break;
      }

      case 'add-member': {
        if (args.length < 2) {
          addOutput('error', 'Usage: gw shared-drives add-member <drive-id> <email> [--role=writer|reader|commenter|organizer]');
          addOutput('info', 'Default role: writer');
          return;
        }
        const driveId = args[0];
        const email = args[1];
        const params = parseArgs(args.slice(2));
        const role = params.role || 'writer';

        await apiRequest('POST', `/api/google/drive/v3/files/${driveId}/permissions`, {
          role: role,
          type: 'user',
          emailAddress: email,
          supportsAllDrives: true
        });

        addOutput('success', `[OK]Added ${email} to shared drive as ${role}`);
        break;
      }

      case 'list-permissions': {
        if (args.length === 0) {
          addOutput('error', 'Usage: gw shared-drives list-permissions <drive-id>');
          addOutput('info', 'Shows all users with access to the shared drive');
          return;
        }
        const driveId = args[0];

        const data = await apiRequest('GET', `/api/google/drive/v3/files/${driveId}/permissions`, {
          supportsAllDrives: true,
          fields: 'permissions(emailAddress,displayName,role,type)'
        });

        if (data.permissions && data.permissions.length > 0) {
          const perms = data.permissions.map((p: any) => {
            const email = (p.emailAddress || p.displayName || 'Domain').substring(0, 40).padEnd(40);
            const role = (p.role || '').substring(0, 15).padEnd(15);
            const type = (p.type || '').substring(0, 10).padEnd(10);
            return `${email} ${role} ${type}`;
          }).join('\n');
          addOutput('success', `\nUSER/GROUP${' '.repeat(30)}ROLE${' '.repeat(11)}TYPE\n${'='.repeat(70)}\n${perms}`);
          addOutput('info', `\nTotal: ${data.permissions.length} permissions`);
        } else {
          addOutput('info', 'No permissions found');
        }
        break;
      }

      case 'delete': {
        if (args.length === 0) {
          addOutput('error', 'Usage: gw shared-drives delete <drive-id>');
          addOutput('info', '[WARN]This will permanently delete the shared drive and all its contents');
          return;
        }
        const driveId = args[0];

        await apiRequest('DELETE', `/api/google/drive/v3/drives/${driveId}`);
        addOutput('success', `[OK]Shared drive deleted: ${driveId}`);
        addOutput('info', '[WARN]All files in the shared drive have been permanently deleted');
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: create, list, get, add-member, list-permissions, delete`);
    }
  };

  // ===== MICROSOFT 365 COMMAND HANDLER =====
  const handleMicrosoft365Command = async (args: string[]) => {
    if (args.length === 0) {
      addOutput('error', 'Usage: helios m365 <resource> <action> [options]');
      addOutput('info', 'Resources: users, licenses, groups');
      return;
    }

    const resource = args[0];
    const action = args[1] || 'list';
    const restArgs = args.slice(2);

    switch (resource) {
      case 'users':
        await handleM365Users(action, restArgs);
        break;
      case 'licenses':
        await handleM365Licenses(action, restArgs);
        break;
      case 'groups':
        await handleM365Groups(action, restArgs);
        break;
      default:
        addOutput('error', `Unknown resource: ${resource}. Use: users, licenses, or groups`);
    }
  };

  // ----- Microsoft 365: Users -----
  const handleM365Users = async (action: string, args: string[]) => {
    switch (action) {
      case 'list': {
        const params = parseArgs(args);
        let endpoint = '/api/microsoft/graph/v1.0/users';

        // Add query parameters if provided
        const queryParams: string[] = [];
        if (params.filter) queryParams.push(`$filter=${encodeURIComponent(params.filter)}`);
        if (params.top) queryParams.push(`$top=${params.top}`);
        if (queryParams.length > 0) {
          endpoint += `?${queryParams.join('&')}`;
        }

        const data = await apiRequest('GET', endpoint);

        if (data.value && data.value.length > 0) {
          const users = data.value.map((u: any) => {
            const email = (u.userPrincipalName || '').padEnd(35);
            const displayName = (u.displayName || '').substring(0, 25).padEnd(25);
            const enabled = u.accountEnabled ? 'Enabled ' : 'Disabled';
            const licenses = (u.assignedLicenses?.length || 0).toString().padStart(3);
            return `${email} ${displayName} ${enabled} ${licenses} licenses`;
          }).join('\n');
          addOutput('success', `\nUSER PRINCIPAL NAME${' '.repeat(16)}DISPLAY NAME${' '.repeat(13)}STATUS    LICENSES\n${'='.repeat(95)}\n${users}`);
        } else {
          addOutput('info', 'No users found');
        }
        break;
      }

      case 'get': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 users get <email> [--format=table|json]');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));
        const format = params.format || 'table';

        const data = await apiRequest('GET', `/api/microsoft/graph/v1.0/users/${email}`);

        if (format === 'json') {
          addOutput('success', JSON.stringify(data, null, 2));
        } else {
          const formatField = (label: string, value: any) => {
            return value !== undefined && value !== null ? `  ${label.padEnd(25)}: ${value}` : '';
          };

          const output = [
            '\nUser Details:',
            '='.repeat(80),
            formatField('User Principal Name', data.userPrincipalName),
            formatField('Display Name', data.displayName),
            formatField('Given Name', data.givenName),
            formatField('Surname', data.surname),
            formatField('Job Title', data.jobTitle),
            formatField('Department', data.department),
            formatField('Office Location', data.officeLocation),
            formatField('Mobile Phone', data.mobilePhone),
            formatField('Business Phones', data.businessPhones?.join(', ')),
            formatField('Account Enabled', data.accountEnabled ? 'Yes' : 'No'),
            formatField('Mail', data.mail),
            formatField('Licenses', data.assignedLicenses?.length || 0),
            formatField('Created', data.createdDateTime ? new Date(data.createdDateTime).toLocaleString() : ''),
            '='.repeat(80),
            '',
            'Use --format=json for full details'
          ].filter(line => line).join('\n');

          addOutput('success', output);
        }
        break;
      }

      case 'create': {
        if (args.length < 3) {
          addOutput('error', 'Usage: helios m365 users create <email> --displayName=<name> --password=<pwd>');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        const [mailNickname] = email.split('@');
        const body: {
          accountEnabled: boolean;
          displayName: string;
          mailNickname: string;
          userPrincipalName: string;
          passwordProfile: { forceChangePasswordNextSignIn: boolean; password: string };
          givenName?: string;
          surname?: string;
        } = {
          accountEnabled: params.disabled !== 'true',
          displayName: params.displayName || params.name,
          mailNickname: mailNickname,
          userPrincipalName: email,
          passwordProfile: {
            forceChangePasswordNextSignIn: params.forceChange !== 'false',
            password: params.password
          }
        };

        if (params.firstName) body.givenName = params.firstName;
        if (params.lastName) body.surname = params.lastName;

        await apiRequest('POST', '/api/microsoft/graph/v1.0/users', body);
        addOutput('success', `[OK]User created: ${email}`);
        break;
      }

      case 'update': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios m365 users update <email> --displayName=<name> [--jobTitle=<title>]');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        const body: any = {};
        if (params.displayName) body.displayName = params.displayName;
        if (params.firstName) body.givenName = params.firstName;
        if (params.lastName) body.surname = params.lastName;
        if (params.jobTitle) body.jobTitle = params.jobTitle;
        if (params.department) body.department = params.department;
        if (params.officeLocation) body.officeLocation = params.officeLocation;
        if (params.mobilePhone) body.mobilePhone = params.mobilePhone;

        await apiRequest('PATCH', `/api/microsoft/graph/v1.0/users/${email}`, body);
        addOutput('success', `[OK]User updated: ${email}`);
        break;
      }

      case 'delete': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 users delete <email>');
          return;
        }
        const email = args[0];
        await apiRequest('DELETE', `/api/microsoft/graph/v1.0/users/${email}`);
        addOutput('success', `[OK]User deleted: ${email}`);
        break;
      }

      case 'reset-password': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 users reset-password <email> [--password=<pwd>] [--forceChange=true|false]');
          return;
        }
        const email = args[0];
        const params = parseArgs(args.slice(1));

        // Generate random password if not provided
        const generatePassword = () => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
          let password = '';
          for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return password;
        };

        const password = params.password || generatePassword();
        const forceChange = params.forceChange !== 'false';

        await apiRequest('PATCH', `/api/microsoft/graph/v1.0/users/${email}`, {
          passwordProfile: {
            forceChangePasswordNextSignIn: forceChange,
            password: password
          }
        });

        addOutput('success', `[OK]Password reset for ${email}`);
        if (!params.password) {
          addOutput('info', `[KEY]Generated password: ${password}`);
        }
        if (forceChange) {
          addOutput('info', '[LOCK]User must change password at next sign-in');
        }
        break;
      }

      case 'enable': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 users enable <email>');
          return;
        }
        const email = args[0];
        await apiRequest('PATCH', `/api/microsoft/graph/v1.0/users/${email}`, { accountEnabled: true });
        addOutput('success', `[OK]User enabled: ${email}`);
        break;
      }

      case 'disable': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 users disable <email>');
          return;
        }
        const email = args[0];
        await apiRequest('PATCH', `/api/microsoft/graph/v1.0/users/${email}`, { accountEnabled: false });
        addOutput('success', `[OK]User disabled: ${email}`);
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Available: list, get, create, update, delete, reset-password, enable, disable`);
    }
  };

  // ----- Microsoft 365: Licenses -----
  const handleM365Licenses = async (action: string, args: string[]) => {
    switch (action) {
      case 'list': {
        const data = await apiRequest('GET', '/api/microsoft/graph/v1.0/subscribedSkus');

        if (data.value && data.value.length > 0) {
          addOutput('success', '\nAvailable License SKUs:');
          addOutput('success', '='.repeat(100));

          data.value.forEach((sku: any) => {
            const skuId = (sku.skuId || '').substring(0, 36).padEnd(37);
            const name = (sku.skuPartNumber || '').substring(0, 30).padEnd(31);
            const enabled = (sku.prepaidUnits?.enabled || 0).toString().padStart(5);
            const consumed = (sku.consumedUnits || 0).toString().padStart(5);
            const available = ((sku.prepaidUnits?.enabled || 0) - (sku.consumedUnits || 0)).toString().padStart(5);

            addOutput('success', `${skuId} ${name} Enabled: ${enabled} Used: ${consumed} Available: ${available}`);
          });
        } else {
          addOutput('info', 'No licenses found');
        }
        break;
      }

      case 'assign': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios m365 licenses assign <email> <skuId>');
          addOutput('info', 'Use "helios m365 licenses list" to see available SKU IDs');
          return;
        }
        const email = args[0];
        const skuId = args[1];

        const body = {
          addLicenses: [
            {
              skuId: skuId
            }
          ],
          removeLicenses: []
        };

        await apiRequest('POST', `/api/microsoft/graph/v1.0/users/${email}/assignLicense`, body);
        addOutput('success', `[OK]License assigned to ${email}`);
        break;
      }

      case 'remove': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios m365 licenses remove <email> <skuId>');
          return;
        }
        const email = args[0];
        const skuId = args[1];

        const body = {
          addLicenses: [],
          removeLicenses: [skuId]
        };

        await apiRequest('POST', `/api/microsoft/graph/v1.0/users/${email}/assignLicense`, body);
        addOutput('success', `[OK]License removed from ${email}`);
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Available: list, assign, remove`);
    }
  };

  // ----- Microsoft 365: Groups -----
  const handleM365Groups = async (action: string, args: string[]) => {
    switch (action) {
      case 'list': {
        const params = parseArgs(args);
        let endpoint = '/api/microsoft/graph/v1.0/groups';

        if (params.filter) {
          endpoint += `?$filter=${encodeURIComponent(params.filter)}`;
        }

        const data = await apiRequest('GET', endpoint);

        if (data.value && data.value.length > 0) {
          const groups = data.value.map((g: any) => {
            const email = (g.mail || 'N/A').padEnd(35);
            const displayName = (g.displayName || '').substring(0, 30).padEnd(31);
            const type = g.groupTypes?.includes('Unified') ? 'M365' : 'Security';
            const typeDisplay = type.padEnd(10);
            return `${email} ${displayName} ${typeDisplay}`;
          }).join('\n');
          addOutput('success', `\nEMAIL${' '.repeat(30)}DISPLAY NAME${' '.repeat(19)}TYPE\n${'='.repeat(85)}\n${groups}`);
        } else {
          addOutput('info', 'No groups found');
        }
        break;
      }

      case 'get': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 groups get <groupId|email>');
          return;
        }
        const groupId = args[0];
        const data = await apiRequest('GET', `/api/microsoft/graph/v1.0/groups/${groupId}`);
        addOutput('success', JSON.stringify(data, null, 2));
        break;
      }

      case 'create': {
        if (args.length < 1) {
          addOutput('error', 'Usage: helios m365 groups create --displayName=<name> --mailNickname=<nickname> [--type=security|m365]');
          return;
        }
        const params = parseArgs(args);

        if (!params.displayName || !params.mailNickname) {
          addOutput('error', 'Both --displayName and --mailNickname are required');
          return;
        }

        const isM365Group = params.type === 'm365';
        const body: any = {
          displayName: params.displayName,
          mailNickname: params.mailNickname,
          mailEnabled: isM365Group,
          securityEnabled: true,
          groupTypes: isM365Group ? ['Unified'] : []
        };

        if (params.description) body.description = params.description;

        await apiRequest('POST', '/api/microsoft/graph/v1.0/groups', body);
        addOutput('success', `[OK]Group created: ${params.displayName}`);
        break;
      }

      case 'add-member': {
        if (args.length < 2) {
          addOutput('error', 'Usage: helios m365 groups add-member <groupId> <userId>');
          return;
        }
        const groupId = args[0];
        const userId = args[1];

        // Get the user's object ID if email was provided
        let userObjectId = userId;
        if (userId.includes('@')) {
          const userData = await apiRequest('GET', `/api/microsoft/graph/v1.0/users/${userId}`);
          userObjectId = userData.id;
        }

        const body = {
          '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userObjectId}`
        };

        await apiRequest('POST', `/api/microsoft/graph/v1.0/groups/${groupId}/members/$ref`, body);
        addOutput('success', `[OK]Member added to group`);
        break;
      }

      case 'list-members': {
        if (args.length === 0) {
          addOutput('error', 'Usage: helios m365 groups list-members <groupId>');
          return;
        }
        const groupId = args[0];
        const data = await apiRequest('GET', `/api/microsoft/graph/v1.0/groups/${groupId}/members`);

        if (data.value && data.value.length > 0) {
          const members = data.value.map((m: any) => {
            const upn = (m.userPrincipalName || 'N/A').padEnd(35);
            const displayName = (m.displayName || '').substring(0, 30).padEnd(31);
            return `${upn} ${displayName}`;
          }).join('\n');
          addOutput('success', `\nUSER PRINCIPAL NAME${' '.repeat(16)}DISPLAY NAME\n${'='.repeat(70)}\n${members}`);
        } else {
          addOutput('info', 'No members found');
        }
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Available: list, get, create, add-member, list-members`);
    }
  };

  // ===== HELIOS USERS COMMAND HANDLER =====
  const handleUsersCommand = async (args: string[]) => {
    const action = args[0] || 'list';
    const restArgs = args.slice(1);

    switch (action) {
      case 'list': {
        const params = parseArgs(restArgs);
        const status = params.status || 'all';
        const userType = params.type || 'staff';

        const data = await apiRequest('GET', `/api/organization/users?status=${status}&userType=${userType}`);
        if (data.success) {
          const users = data.data.map((u: any) => {
            const email = (u.email || '').padEnd(30);
            // Extract first name from email if not in database
            const emailPrefix = u.email ? u.email.split('@')[0].split('.')[0] : '';
            // Check for all possible field name variations (camelCase, snake_case, lowercase)
            const firstName = (u.firstName || u.first_name || u.firstname || emailPrefix || 'N/A').substring(0, 15).padEnd(15);
            const lastName = (u.lastName || u.last_name || u.lastname || '').substring(0, 15).padEnd(15);

            // Platform detection - show which platforms user exists in
            const platforms = u.platforms || [];
            let platformStr = 'Local';
            if (platforms.includes('google_workspace') && platforms.includes('microsoft_365')) {
              platformStr = 'GW, M365';
            } else if (platforms.includes('google_workspace')) {
              platformStr = 'GW';
            } else if (platforms.includes('microsoft_365')) {
              platformStr = 'M365';
            }
            const platformDisplay = platformStr.padEnd(12);

            const status = (u.userStatus || u.user_status || u.userstatus || u.status || 'active').padEnd(10);
            return `${email} ${firstName} ${lastName} ${platformDisplay} ${status}`;
          }).join('\n');
          addOutput('success', `\nEMAIL${' '.repeat(25)}FIRST NAME${' '.repeat(5)}LAST NAME${' '.repeat(6)}PLATFORMS    STATUS\n${'='.repeat(90)}\n${users}`);
        }
        break;
      }

      case 'debug': {
        const data = await apiRequest('GET', '/api/organization/users?status=all&userType=staff');
        addOutput('info', 'API Response:');
        addOutput('info', JSON.stringify(data, null, 2));

        // Show first user's fields
        if (data.success && data.data && data.data.length > 0) {
          const firstUser = data.data[0];
          addOutput('info', '\nFirst user fields:');
          addOutput('info', `  email: ${firstUser.email}`);
          addOutput('info', `  firstName: ${firstUser.firstName}`);
          addOutput('info', `  first_name: ${firstUser.first_name}`);
          addOutput('info', `  lastName: ${firstUser.lastName}`);
          addOutput('info', `  last_name: ${firstUser.last_name}`);
        }
        break;
      }

      default:
        addOutput('error', `Unknown action: ${action}. Use: list, debug`);
    }
  };

  // ===== HELIOS GROUPS COMMAND HANDLER =====
  const handleGroupsCommand = async (_args: string[]) => {
    addOutput('info', 'Helios groups commands coming soon...');
  };

  // ----- Helper: Parse --key=value arguments -----
  const parseArgs = (args: string[]): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, ...valueParts] = arg.substring(2).split('=');
        let value = valueParts.join('='); // Handle values with '=' in them
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        result[key] = value;
      }
    }
    return result;
  };

  // ----- Help Modal -----
  const showHelp = () => {
    setShowHelpModal(true);
  };

  // ----- Examples Modal -----
  const showExamples = () => {
    setShowExamplesModal(true);
  };

  // ----- Keyboard Handling -----
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(currentCommand);
      setCurrentCommand('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        if (newIndex === commandHistory.length - 1 && historyIndex === commandHistory.length - 1) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      // Ctrl+L / Cmd+L to clear console (standard terminal shortcut)
      e.preventDefault();
      setOutput([]);
      setCurrentCommand('');
      inputRef.current?.focus();
    } else if (e.key === 'Escape') {
      // Escape to close modals or focus input
      if (showHelpModal || showExamplesModal) {
        setShowHelpModal(false);
        setShowExamplesModal(false);
      }
      inputRef.current?.focus();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="developer-console-page">
      <div className="page-header">
        <h1>Developer Console</h1>
        <p className="page-subtitle">Execute commands and interact with Helios API</p>
      </div>

      <div className="console-container" onClick={() => inputRef.current?.focus()}>
        <div className="console-toolbar">
          <div className="console-toolbar-left">
            <div className="console-status">
              <span className={`status-dot ${isExecuting ? 'executing' : 'ready'}`}></span>
              <span>{isExecuting ? 'Executing...' : 'Ready'}</span>
            </div>
          </div>
          <div className="console-toolbar-right">
            <button
              onClick={() => setShowHelpModal(true)}
              className="btn-console-action"
              title="Show help"
            >
              <HelpCircle size={16} />
            </button>
            <button
              onClick={() => setShowExamplesModal(true)}
              className="btn-console-action"
              title="Show examples"
            >
              <BookOpen size={16} />
            </button>
            <button
              onClick={() => setOutput([])}
              className="btn-console-action"
              title="Clear console"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="console-output" ref={outputRef}>
          {output.map((item, index) => (
            <div key={index} className={`output-line output-${item.type}`}>
              <span className="output-timestamp">[{formatTimestamp(item.timestamp)}]</span>
              <span className="output-content" style={{ whiteSpace: 'pre-wrap' }}>{item.content}</span>
            </div>
          ))}
        </div>

        <div className="console-input">
          <span className="input-prompt">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Type a command..."
            className="input-field"
          />
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Available Commands</h2>
              <button onClick={() => setShowHelpModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {/* Note about syntax */}
              <div className="help-note" style={{ marginBottom: '16px', padding: '12px', background: '#2d2d2d', borderRadius: '4px', fontSize: '13px', color: '#9ca3af' }}>
                <strong>Note:</strong> The "helios" prefix is optional. Type <code style={{ background: '#1e1e1e', padding: '2px 6px', borderRadius: '3px' }}>gw users list</code> or <code style={{ background: '#1e1e1e', padding: '2px 6px', borderRadius: '3px' }}>helios gw users list</code> - both work!
              </div>

              {/* Built-in Commands */}
              <div className="help-section">
                <h3>Built-in Commands</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">help</td>
                      <td className="command-desc">Show this help modal with all available commands</td>
                    </tr>
                    <tr>
                      <td className="command-name">examples</td>
                      <td className="command-desc">Show practical usage examples for common operations</td>
                    </tr>
                    <tr>
                      <td className="command-name">clear</td>
                      <td className="command-desc">Clear all console output and start fresh</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Google Workspace Users */}
              <div className="help-section">
                <h3>Google Workspace Users</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">gw users list</td>
                      <td className="command-desc">List all Google Workspace users in a table</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users get &lt;email&gt;</td>
                      <td className="command-desc">Get detailed information about a specific user</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users create &lt;email&gt; --firstName=X --lastName=Y --password=Z</td>
                      <td className="command-desc">Create a new Google Workspace user with specified details</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users suspend &lt;email&gt;</td>
                      <td className="command-desc">Suspend a user account (prevents login)</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users restore &lt;email&gt;</td>
                      <td className="command-desc">Restore a suspended user account</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users delete &lt;email&gt;</td>
                      <td className="command-desc">Permanently delete a user (cannot be undone)</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users move &lt;email&gt; --ou=/Path</td>
                      <td className="command-desc">Move user to a different organizational unit</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw users groups &lt;email&gt;</td>
                      <td className="command-desc">List all groups that this user belongs to</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Groups */}
              <div className="help-section">
                <h3>Groups</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">gw groups list</td>
                      <td className="command-desc">List all Google Workspace groups</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups get &lt;email&gt;</td>
                      <td className="command-desc">Get detailed information about a group</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups create &lt;email&gt; --name="Name"</td>
                      <td className="command-desc">Create a new group with specified properties</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups update &lt;email&gt; --name="New Name"</td>
                      <td className="command-desc">Update group properties (name, description, etc.)</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups delete &lt;email&gt;</td>
                      <td className="command-desc">Delete a group permanently</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups members &lt;email&gt;</td>
                      <td className="command-desc">List all members of a group</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups add-member &lt;group&gt; &lt;user&gt;</td>
                      <td className="command-desc">Add a user to a group (optionally specify --role=OWNER)</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw groups remove-member &lt;group&gt; &lt;user&gt;</td>
                      <td className="command-desc">Remove a user from a group</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Organizational Units */}
              <div className="help-section">
                <h3>Organizational Units</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">gw orgunits list</td>
                      <td className="command-desc">List all organizational units with user counts</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw orgunits get &lt;path&gt;</td>
                      <td className="command-desc">Get details about a specific OU (e.g., /Staff/Sales)</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw orgunits create &lt;parent&gt; --name="Name"</td>
                      <td className="command-desc">Create a new organizational unit under parent OU</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Email Delegation */}
              <div className="help-section">
                <h3>Email Delegation</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">gw delegates list &lt;email&gt;</td>
                      <td className="command-desc">List all delegates who can access user's email</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw delegates add &lt;user&gt; &lt;delegate&gt;</td>
                      <td className="command-desc">Grant email delegation access to another user</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw delegates remove &lt;user&gt; &lt;delegate&gt;</td>
                      <td className="command-desc">Revoke email delegation access</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sync Operations */}
              <div className="help-section">
                <h3>Sync Operations</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">gw sync users</td>
                      <td className="command-desc">Manually sync users from Google Workspace</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw sync groups</td>
                      <td className="command-desc">Manually sync groups from Google Workspace</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw sync orgunits</td>
                      <td className="command-desc">Manually sync organizational units</td>
                    </tr>
                    <tr>
                      <td className="command-name">gw sync all</td>
                      <td className="command-desc">Sync all data (users, groups, OUs) at once</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Microsoft 365 Users */}
              <div className="help-section">
                <h3>Microsoft 365 Users</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">m365 users list</td>
                      <td className="command-desc">List all Microsoft 365 users with status and license count</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users get &lt;email&gt;</td>
                      <td className="command-desc">Get detailed information about a specific user</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users create &lt;email&gt; --displayName=X --password=Y</td>
                      <td className="command-desc">Create a new Microsoft 365 user</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users update &lt;email&gt; --displayName=X --jobTitle=Y</td>
                      <td className="command-desc">Update user properties</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users delete &lt;email&gt;</td>
                      <td className="command-desc">Delete a user permanently</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users reset-password &lt;email&gt;</td>
                      <td className="command-desc">Reset user password (generates random if not provided)</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users enable &lt;email&gt;</td>
                      <td className="command-desc">Enable a disabled user account</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 users disable &lt;email&gt;</td>
                      <td className="command-desc">Disable a user account (prevents login)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Microsoft 365 Licenses */}
              <div className="help-section">
                <h3>Microsoft 365 Licenses</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">m365 licenses list</td>
                      <td className="command-desc">List all available license SKUs with usage stats</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 licenses assign &lt;email&gt; &lt;skuId&gt;</td>
                      <td className="command-desc">Assign a license to a user</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 licenses remove &lt;email&gt; &lt;skuId&gt;</td>
                      <td className="command-desc">Remove a license from a user</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Microsoft 365 Groups */}
              <div className="help-section">
                <h3>Microsoft 365 Groups</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">m365 groups list</td>
                      <td className="command-desc">List all Microsoft 365 and security groups</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 groups get &lt;groupId&gt;</td>
                      <td className="command-desc">Get detailed information about a group</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 groups create --displayName=X --mailNickname=Y</td>
                      <td className="command-desc">Create a new group (use --type=m365 for Microsoft 365 group)</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 groups add-member &lt;groupId&gt; &lt;userId&gt;</td>
                      <td className="command-desc">Add a user to a group (accepts email or object ID)</td>
                    </tr>
                    <tr>
                      <td className="command-name">m365 groups list-members &lt;groupId&gt;</td>
                      <td className="command-desc">List all members of a group</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Helios Users */}
              <div className="help-section">
                <h3>Helios Platform Users</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">users list</td>
                      <td className="command-desc">
                        List all Helios platform administrator users with platform membership
                        <div className="command-example">Shows which external platforms each user exists in (GW, M365, Local)</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="command-name">users debug</td>
                      <td className="command-desc">Show raw API response for debugging</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Direct API */}
              <div className="help-section">
                <h3>Direct API Access (Transparent Proxy)</h3>
                <table className="command-table">
                  <tbody>
                    <tr>
                      <td className="command-name">api GET &lt;path&gt;</td>
                      <td className="command-desc">
                        Make a GET request to any Google Workspace API
                        <div className="command-example">Example: helios api GET /api/google/admin/directory/v1/users</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="command-name">api POST &lt;path&gt; '&#123;...&#125;'</td>
                      <td className="command-desc">
                        Make a POST request with JSON body
                        <div className="command-example">Example: helios api POST /api/google/admin/directory/v1/users '&#123;"primaryEmail":"user@company.com"&#125;'</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="command-name">api PATCH &lt;path&gt; '&#123;...&#125;'</td>
                      <td className="command-desc">Make a PATCH request to update resources</td>
                    </tr>
                    <tr>
                      <td className="command-name">api DELETE &lt;path&gt;</td>
                      <td className="command-desc">Make a DELETE request to remove resources</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tips */}
              <div className="help-section">
                <h3>Tips</h3>
                <ul className="help-tips">
                  <li>Use ↑/↓ arrow keys to navigate command history</li>
                  <li>Press Ctrl+L (Cmd+L on Mac) to clear the console</li>
                  <li>Press Escape to close modals and return focus to console</li>
                  <li>Click anywhere in the console to focus the input field</li>
                  <li>Platform codes: <strong>GW</strong> = Google Workspace, <strong>M365</strong> = Microsoft 365, <strong>Local</strong> = Helios only</li>
                  <li>All commands are automatically logged with audit trail</li>
                  <li>Use the transparent proxy (helios api) for any Google Workspace API</li>
                  <li>Check docs at: API Documentation (in user menu)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Examples Modal */}
      {showExamplesModal && (
        <div className="modal-backdrop" onClick={() => setShowExamplesModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Usage Examples</h2>
              <button onClick={() => setShowExamplesModal(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="example-section">
                <h4>List all Google Workspace users</h4>
                <code className="example-code">gw users list</code>
              </div>

              <div className="example-section">
                <h4>Create a new user</h4>
                <code className="example-code">gw users create john.doe@company.com --firstName="John" --lastName="Doe" --password="TempPass123!" --ou="/Staff"</code>
              </div>

              <div className="example-section">
                <h4>Suspend a user account</h4>
                <code className="example-code">gw users suspend john.doe@company.com</code>
              </div>

              <div className="example-section">
                <h4>Restore a suspended user</h4>
                <code className="example-code">gw users restore john.doe@company.com</code>
              </div>

              <div className="example-section">
                <h4>List all groups</h4>
                <code className="example-code">gw groups list</code>
              </div>

              <div className="example-section">
                <h4>Create a new group</h4>
                <code className="example-code">gw groups create sales@company.com --name="Sales Team" --description="Sales department group"</code>
              </div>

              <div className="example-section">
                <h4>Add user to group</h4>
                <code className="example-code">gw groups add-member sales@company.com john.doe@company.com --role=MEMBER</code>
              </div>

              <div className="example-section">
                <h4>Remove user from group</h4>
                <code className="example-code">gw groups remove-member sales@company.com john.doe@company.com</code>
              </div>

              <div className="example-section">
                <h4>Move user to different organizational unit</h4>
                <code className="example-code">gw users move john.doe@company.com --ou="/Staff/Sales"</code>
              </div>

              <div className="example-section">
                <h4>Grant email delegation access</h4>
                <code className="example-code">gw delegates add manager@company.com assistant@company.com</code>
              </div>

              <div className="example-section">
                <h4>List user's email delegates</h4>
                <code className="example-code">gw delegates list manager@company.com</code>
              </div>

              <div className="example-section">
                <h4>Sync all data from Google Workspace</h4>
                <code className="example-code">gw sync all</code>
              </div>

              <div className="example-section">
                <h4>List all Microsoft 365 users</h4>
                <code className="example-code">m365 users list</code>
              </div>

              <div className="example-section">
                <h4>Create a Microsoft 365 user</h4>
                <code className="example-code">m365 users create jane.smith@company.com --displayName="Jane Smith" --password="TempPass123!"</code>
              </div>

              <div className="example-section">
                <h4>Reset Microsoft 365 user password</h4>
                <code className="example-code">m365 users reset-password jane.smith@company.com</code>
              </div>

              <div className="example-section">
                <h4>List available Microsoft 365 licenses</h4>
                <code className="example-code">m365 licenses list</code>
              </div>

              <div className="example-section">
                <h4>Assign license to Microsoft 365 user</h4>
                <code className="example-code">m365 licenses assign jane.smith@company.com &lt;sku-id&gt;</code>
              </div>

              <div className="example-section">
                <h4>List Microsoft 365 groups</h4>
                <code className="example-code">m365 groups list</code>
              </div>

              <div className="example-section">
                <h4>Create Microsoft 365 group</h4>
                <code className="example-code">m365 groups create --displayName="Marketing Team" --mailNickname="marketing" --type=m365</code>
              </div>

              <div className="example-section">
                <h4>Add member to Microsoft 365 group</h4>
                <code className="example-code">m365 groups add-member &lt;group-id&gt; jane.smith@company.com</code>
              </div>

              <div className="example-section">
                <h4>Direct API call via transparent proxy</h4>
                <code className="example-code">api GET /api/google/admin/directory/v1/users/john.doe@company.com</code>
              </div>

              <div className="example-section">
                <h4>Create resource via API</h4>
                <code className="example-code">api POST /api/google/admin/directory/v1/users '&#123;"primaryEmail":"new.user@company.com","name":&#123;"givenName":"New","familyName":"User"&#125;,"password":"TempPass123!"&#125;'</code>
              </div>

              <div className="example-section">
                <h4>List Helios platform users</h4>
                <code className="example-code">users list</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
