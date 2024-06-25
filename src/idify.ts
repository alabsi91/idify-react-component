import React from 'react';

import type { ComponentClass, ComponentProps, ForwardRefRenderFunction, ForwardedRef, PropsWithoutRef } from 'react';

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
 * @param RC - A React functional component.
 * @param ids - An array of strings or an object with string values representing IDs.
 * @returns - A class component.
 */
export function CreateFromFC<const IDs extends string, R extends object, P extends object, const PREFIX extends string = '$'>(
  RC: ForwardRefRenderFunction<R, P>,
  ids?: readonly IDs[] | { [K: PropertyKey]: IDs },
  prefix: PREFIX = '$' as PREFIX,
) {
  const ForwardedRefComponent = React.forwardRef<R, P>(RC);

  type ComponentRefType = {
    /** Mount the component. Mounting a mounted component has no effect. */
    mount: () => void;
    /** Unmount the component. Unmounting an unmounted component has no effect. */
    unMount: () => void;
    /** Force re-render the component. */
    forceRerender: () => void;
    /** Get the name of the parent component, could be useful for debugging. */
    getParentName: () => string | null;
  } & R;

  type IdRefObjectType<T extends string> = { [key in `${PREFIX}${T}`]: ComponentRefType | null };

  class ClassComponent<T extends string = IDs> extends React.Component<{ id?: T } & P> {
    static refs = new Map<string, ComponentRefType>();

    state = { isMounted: true, update: 0 };

    componentWillUnmount(): void {
      if (this.props.id) ClassComponent.refs.delete(this.props.id);
    }

    #registerRef = (node: R | null) => {
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
    get(target: typeof ClassComponent, prop: keyof typeof ClassComponent | 'setIdType' | 'setComponentType') {
      if (prop === 'setIdType' || prop === 'setComponentType') return () => ProxyComponent;

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

  type ClassComponentT = typeof ClassComponent<IDs>;
  const ProxyComponent = new Proxy<ClassComponentT>(ClassComponent, proxyHandler);

  type ReturnType = ClassComponentT &
    IdRefObjectType<IDs> & {
      /** Set the ID type, only for typescript autocomplete purpose. */
      setIdType: <T extends IDs>() => typeof ClassComponent<T> & IdRefObjectType<T>;
      /** Set the component type when the component is using generics in its props, only for typescript. */
      setComponentType: <F, T extends string = IDs>() => F & IdRefObjectType<T> & { refs: Map<T, ComponentRefType> };
    };

  return ProxyComponent as ReturnType;
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
