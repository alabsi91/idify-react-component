import React from 'react';

import type { ComponentClass, ComponentProps, ForwardedRef, PropsWithoutRef, ReactNode } from 'react';

/**
 * - Takes a functional component that takes parameters, props, and a ref, and forwards the ref parameter.
 * - Using `forwardRef` in your component is not necessary.
 * - You can restrict IDs by passing a second parameter, `ids`.
 *
 * @example
 *   function MyComponentFC(props: PropsType, ref: ForwardedRef<RefType>) {
 *     useImperativeHandle(ref, () => ({ click: () => null }));
 *     return <></>;
 *   }
 *
 *   let MyComponent = CreateFromFC(MyComponentFC).setIdType<'componentId' | 'componentId2'>();
 *
 *   // Optionally add types
 *   MyComponent = MyComponent.setIdType<'componentId' | 'componentId2'>();
 *
 *   function App() {
 *     const onClick = () => {
 *       MyComponent.$componentId?.click();
 *     };
 *
 *     return <MyComponent id='componentId' />;
 *   }
 *
 * @param FC - A React functional component.
 * @param ids - An array of strings or an object with string values representing IDs.
 * @returns - A class component.
 */

export function CreateFromFC<
  P extends object,
  F extends object,
  R extends ReactNode,
  TF,
  const I extends string,
  const PREFIX extends string = '$',
>(
  FC: ((props: P, ref: ForwardedRef<F>) => R) | TF,
  ids?: readonly I[] | { [K: PropertyKey]: I },
  prefix: PREFIX = '$' as PREFIX,
) {
  // get the ids type from the props or from the ids param
  type IDs = P extends { id?: infer T } ? (T extends string ? T : I) : I;

  type ComponentFCWithID<T extends string = IDs> = (props: P & { id?: T }, ref: ForwardedRef<F>) => R;

  const ForwardedRefComponent = React.forwardRef<F, P>(FC as ComponentFCWithID);

  type ComponentRefType = {
    /** Mount the component. Mounting a mounted component has no effect. */
    mount: () => void;
    /** Unmount the component. Unmounting an unmounted component has no effect. */
    unMount: () => void;
    /** Force re-render the component. */
    forceRerender: () => void;
    /** Get the name of the parent component, could be useful for debugging. */
    getParentName: () => string | null;
  } & F;

  type IdRefObjectType<T extends string> = { [key in `${PREFIX}${T}`]: ComponentRefType | null };

  class ClassComponent extends React.Component<{ id?: IDs } & P> {
    static refs = new Map<string, ComponentRefType>();

    state = { isMounted: true, update: 0 };

    componentWillUnmount(): void {
      if (this.props.id) ClassComponent.refs.delete(this.props.id);
    }

    #registerRef = (node: F | null) => {
      if (!node || !this.props.id) return;

      const getParentName = () => {
        // @ts-expect-error doesn't exist
        return (this._reactInternals?._debugOwner?.elementType?.name ?? null) as string | null;
      };

      const mount = () => {
        if (node && this.props.id) ClassComponent.refs.set(this.props.id, refObject);
        this.setState({ isMounted: true });
      };

      const unMount = () => {
        if (node && this.props.id) ClassComponent.refs.delete(this.props.id);
        this.setState({ isMounted: false });
      };

      const forceRerender = () => this.setState({ update: Math.random() });

      // merge without cloning the original ref object
      const refObject = node as ComponentRefType;
      refObject.getParentName = getParentName;
      refObject.mount = mount;
      refObject.unMount = unMount;
      refObject.forceRerender = forceRerender;

      ClassComponent.refs.set(this.props.id, refObject);
    };

    render() {
      if (!this.state.isMounted) return null;

      const props = this.props as PropsWithoutRef<P>;

      return React.createElement(ForwardedRefComponent, { ...props, ref: this.#registerRef });
    }
  }

  const proxyHandler = {
    get(target: typeof ClassComponent, prop: keyof typeof ClassComponent | 'setIdType') {
      if (prop === 'setIdType') return () => ProxyComponent;

      // without a prefix
      if (!prefix) {
        // try to get the ref
        const id = prop as IDs;
        const ref = ClassComponent.refs.get(id);

        // ref not found default to original or null
        if (!ref) return target[prop];

        return ref;
      }

      if (!prop.startsWith(prefix)) return target[prop];

      const id = prop.slice(prefix.length) as IDs;

      if (Array.isArray(ids) && !ids.includes(id)) {
        console.error(`[Error] The ID "${id}" is not found in provided IDs array!`);
        return;
      }

      if (typeof ids === 'object' && !Object.values(ids).includes(id)) {
        console.error(`[Error] The ID "${id}" is not found in provided IDs object!`);
        return;
      }

      const ref = ClassComponent.refs.get(id);
      if (!ref) return null;

      return ClassComponent.refs.get(id) ?? null;
    },
  };

  const ProxyComponent = new Proxy<typeof ClassComponent>(ClassComponent, proxyHandler);

  type ReturnCP<T extends string = IDs> = (P extends { id?: string } ? TF : ComponentFCWithID<T>) &
    IdRefObjectType<T> & { refs: Map<T, ComponentRefType> };

  type CreateFromFCReturnType = ReturnCP & {
    /** Set the ID type, only for typescript autocomplete purpose. */
    setIdType: <T extends IDs>() => ReturnCP<T>;
  };

  return ProxyComponent as unknown as CreateFromFCReturnType;
}

/** Create from a react class component */
export function CreateFromRC<
  const IDs extends string,
  C extends ComponentClass,
  P extends ComponentProps<C>,
  R extends InstanceType<C>,
>(RC: C, ids?: readonly IDs[] | { [K: PropertyKey]: IDs }) {
  const FC = (props: P, ref: ForwardedRef<R>) => React.createElement(RC, { ...props, ref });
  return CreateFromFC(FC, ids);
}
