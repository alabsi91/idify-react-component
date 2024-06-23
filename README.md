# Idify React Component

This library provides a utility to create class components from functional components or existing class components, with additional ref management capabilities. This allows you to access and manipulate component instances using IDs.

## Installation

```bash
npm install idify-react-component
```

## Usage

### Creating a Component from a Functional Component

#### First create your component:

```tsx
// File: ./MyComponent.tsx
import React, { useImperativeHandle, type ForwardedRef } from 'react';
import { CreateFromFC } from 'idify-react-component';

type PropsType = {};
type RefType = { click: () => void };

function MyComponentFC(props: PropsType, ref: ForwardedRef<RefType>) {
  const onClick = () => {
    // Do something
  };

  useImperativeHandle(ref, () => ({ click: onClick })); // ref object you will get access to later

  return <div></div>;
}

const MyComponent = CreateFromFC(MyComponentFC);
export default MyComponent;
```

#### Then use it:

```tsx
// File: ./App.tsx
import React from 'react';
import MyComponent from './src/MyComponent';

function App() {
  const onClick = () => {
    MyComponent.$componentId?.click();
  };

  return <MyComponent id='componentId' />;
}
```

### Notes

- You can retrieve all mounted components from the `refs` map, where each entry has a `key` as the component's ID and the `value` as the reference. Use `MyComponent.refs` to access this map

- Regardless of where the component is rendered, you can obtain a reference to it from anywhere as long as the component is mounted.

- If you don't pass an `id` prop, a reference will not be registered in the refs `map`.

- Several additional methods will automatically be added to the component reference object: `mount`, `unMount`, `forceRerender`, and `getParentName`.

- You can optionally restrict the IDs that can be used and get additional TypeScript types by passing a second parameter, `ids`:

```ts
const IDS = ['componentId', 'componentId2'] as const;
const MyComponent = CreateFromFC(MyComponentFC, IDS);

// OR

const IDS = {
  forHomePage: 'componentId',
  forDetailPage: 'componentId2',
} as const;

const MyComponent = CreateFromFC(MyComponentFC, IDS);
```

- If you only need TypeScript type checking per component, you can use the `setIdType` method. This method doesn't change any functionality but adds types to the component:

```ts
import MyComponent from './src/MyComponent';

const MyComponentTyped = MyComponent.setIdType<'componentId' | 'componentId2'>();
```

- To create from a class component, you can use `CreateFromRC`:

```ts
import ClassComponent from 'some-ui-library';
import { CreateFromRC } from 'idify-react-component';

const MyComponent = CreateFromRC(ClassComponent);
```

> [!WARNING]
> Components with generic types cannot be inferred by TypeScript. To resolve this, use `setComponentType` as an alternative.

```tsx
type IDs = 'componentId' | 'componentId2'; // or just a string type

// 👇 Add the id type to your props
type PropsType<T> = { id?: IDs; myProp: T };

type RefType = { click: () => void };

function MyComponentFC<T>(props: PropsType<T>, ref: ForwardedRef<RefType>) {
  const onClick = () => {
    // Perform some action
  };

  // ref object you will get access to later
  useImperativeHandle(ref, () => ({ click: onClick }));

  return <div></div>;
}

const MyComponent = CreateFromFC(MyComponentFC).setComponentType<typeof MyComponentFC, IDs>();

export default MyComponent;
```

## API

### `CreateFromFC`

#### Parameters

- `RC` (ForwardRefRenderFunction): A React functional component.
- `ids` (optional, readonly array of strings or object with string values): An array of strings or an object with string values representing IDs.

#### Returns

A class component with the following additional properties:

- `refs` (Map): A map of component IDs to their ref objects.
- `setIdType` (function): Sets the ID type for TypeScript autocomplete.

### `CreateFromRC`

#### Parameters

- `RC` (ComponentClass): A React class component.
- `ids` (optional, readonly array of strings or object with string values): An array of strings or an object with string values representing IDs.

#### Returns

A class component with the same additional properties as `CreateFromFC`.

## License

This library is licensed under the MIT License. See the LICENSE file for more information.
