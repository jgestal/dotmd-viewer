import type { CommandId } from './ids';
import {
  matchesEvent,
  resolveAccelerator,
  type AcceleratorSpec,
  type KeyEventLike,
  type Platform,
} from './shortcuts';

export interface Command {
  readonly id: CommandId;
  /** i18n key of the label. */
  readonly label: string;
  readonly accelerator?: AcceleratorSpec;
  run(): void | Promise<void>;
  enabled?(): boolean;
  checked?(): boolean;
}

export interface KeyboardEventLike extends KeyEventLike {
  readonly isComposing?: boolean;
}

export interface CommandRegistry {
  get(id: CommandId): Command | undefined;
  all(): readonly Command[];
  /** Runs the command unless it is unknown or disabled. */
  execute(id: CommandId): Promise<void>;
  findByEvent(event: KeyboardEventLike, platform: Platform): Command | undefined;
}

function triggeredBy(command: Command, event: KeyboardEventLike, platform: Platform): boolean {
  const accelerator = command.accelerator && resolveAccelerator(command.accelerator, platform);
  return accelerator !== undefined && matchesEvent(accelerator, event, platform);
}

export function createRegistry(commands: readonly Command[]): CommandRegistry {
  const byId = new Map(commands.map((command) => [command.id, command]));
  return {
    get: (id) => byId.get(id),
    all: () => commands,
    async execute(id) {
      const command = byId.get(id);
      if (command && command.enabled?.() !== false) await command.run();
    },
    findByEvent: (event, platform) =>
      event.isComposing
        ? undefined
        : commands.find((command) => triggeredBy(command, event, platform)),
  };
}
