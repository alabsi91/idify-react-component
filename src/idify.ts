import React from 'react';

import type { ComponentClass, ComponentProps, ForwardedRef, PropsWithoutRef, ReactNode } from 'react';

type Options<I extends string, PREFIX extends string, K extends string> = {
  ids?: readonly I[] | { [K: PropertyKey]: I };
  prefix?: PREFIX;
  idPropName?: K;
};

/**
 * - Takes a functional component that takes parameters, props, and a ref, and forwards the ref parameter.
 * - Using `forwardRef` in your component is not necessary.
 *
 * @example
 *   function MyComponentFC(props: PropsType, ref: ForwardedRef<RefType>) {
 *     useImperativeHandle(ref, () => ({ click: () => null }));
 *     return <></>;
 *   }
 *
 *   // Optionally add types
 *   const MyComponent = CreateFromFC(MyComponentFC).setIdType<'componentId' | 'componentId2'>();
 *
 *   function App() {
 *     const onClick = () => {
 *       MyComponent.$componentId?.click();
 *     };
 *
 *     return <MyComponent id='componentId' />;
 *   }
 *
 * @param functionComponent - A React functional component.
 * @param options
 * @returns - A class component.
 */
export function CreateFromFC<
  P extends object,
  F extends object,
  R extends ReactNode,
  FC,
  I extends string,
  PREFIX extends string = '$',
  K extends string = 'id',
>(
  functionComponent: ((props: P, ref: ForwardedRef<F>) => R) | FC,
  { ids, idPropName = 'id' as K, prefix = '$' as PREFIX }: Options<I, PREFIX, K> = {},
) {
  // get the ids type from the props or from the ids param
  type IDs = P extends { [Key in K]?: infer T } ? (T extends string ? T : I) : I;

  type ComponentFCWithID<T extends string = IDs> = (props: P & { [Key in K]?: T }, ref: ForwardedRef<F>) => R;

  const ForwardedRefComponent = React.forwardRef<F, P>(functionComponent as ComponentFCWithID);

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

  class ClassComponent extends React.Component<{ [Key in K]?: IDs } & P> {
    static refs = new Map<string, ComponentRefType>();

    state = { isMounted: true, update: 0 };

    componentWillUnmount(): void {
      const id = this.props[idPropName];
      if (!id) return;
      if (id) ClassComponent.refs.delete(id);
    }

    #registerRef = (node: F | null) => {
      const id = this.props[idPropName];
      if (!node || !id) return;

      const getParentName = () => {
        // @ts-expect-error doesn't exist
        return (this._reactInternals?._debugOwner?.elementType?.name ?? null) as string | null;
      };

      const mount = () => {
        if (node && id) ClassComponent.refs.set(id, refObject);
        this.setState({ isMounted: true });
      };

      const unMount = () => {
        if (node && id) ClassComponent.refs.delete(id);
        this.setState({ isMounted: false });
      };

      const forceRerender = () => this.setState({ update: Math.random() });

      // merge without cloning the original ref object
      const refObject = node as ComponentRefType;
      refObject.getParentName = getParentName;
      refObject.mount = mount;
      refObject.unMount = unMount;
      refObject.forceRerender = forceRerender;

      ClassComponent.refs.set(id, refObject);
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

      return ClassComponent.refs.get(id) ?? null;
    },
  };

  const ProxyComponent = new Proxy<typeof ClassComponent>(ClassComponent, proxyHandler);

  type ReturnCP<T extends string = IDs> = (P extends { [Key in K]?: string } ? FC : ComponentFCWithID<T>) &
    IdRefObjectType<T> & { refs: Map<T, ComponentRefType> };

  type CreateFromFCReturnType = ReturnCP & {
    /** Set the ID type, only for typescript autocomplete purpose. */
    setIdType: <T extends IDs>() => ReturnCP<T>;
  };

  return ProxyComponent as unknown as CreateFromFCReturnType;
}

/** Create from a react class component */
export function CreateFromRC<
  C extends ComponentClass,
  P extends ComponentProps<C>,
  R extends InstanceType<C>,
  I extends string,
  PREFIX extends string = '$',
  K extends string = 'id',
>(classComponent: C, options?: Options<I, PREFIX, K>) {
  const FC = (props: P, ref: ForwardedRef<R>) => React.createElement(classComponent, { ...props, ref });
  return CreateFromFC(FC, options);
}
