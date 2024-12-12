/**
 * Joins two array based on unique key
 * @param array1 {- First array}
 * @param array2 {- Second array}
 * @param prop1  {- Unique key of first array objects}
 * @param prop2 {- Unique key of second array objects}
 * @returns An arrray of object {left, right}. left is the left match, right is the right match
 */
export function fullOuterJoin<T1 extends object, T2 extends object>(array1: Array<T1>, array2: Array<T2>, prop1: keyof T1, prop2: keyof T2) {
  const map = new Map<string, { left?: T1; right?: T2 }>();
  for (const elem1 of array1) {
    map.set(elem1[prop1].toString(), { left: elem1, right: null });
  }
  for (const elem2 of array2) {
    if (!map.get(elem2[prop2].toString())) {
      map.set(elem2[prop2].toString(), { left: null });
    }
    map.set(elem2[prop2].toString(), { ...map.get(elem2[prop2].toString()), right: elem2 });
  }

  return Array.from(map, ([_, value]) => value);
}
