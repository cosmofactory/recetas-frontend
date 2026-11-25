// A press inside the results (an option, a heading, the scroller's padding)
// must not take focus from the combobox input: the APG list-autocomplete
// combobox keeps focus in the field.
export const keepInputFocus = (event: MouseEvent) => event.preventDefault();
