// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use std::collections::HashSet;

use deno_ast::swc::common::SyntaxContext;
use deno_ast::view::*;

use crate::polyfills::Polyfill;
use crate::polyfills::PolyfillVisitContext;

pub struct FillPolyfillsParams<'a> {
  pub program: &'a Program<'a>,
  pub top_level_context: SyntaxContext,
  pub top_level_decls: &'a HashSet<String>,
  pub searching_polyfills: &'a mut Vec<Box<dyn Polyfill>>,
  pub found_polyfills: &'a mut Vec<Box<dyn Polyfill>>,
}

struct Context<'a> {
  visit_context: PolyfillVisitContext<'a>,
  searching_polyfills: &'a mut Vec<Box<dyn Polyfill>>,
  found_polyfills: &'a mut Vec<Box<dyn Polyfill>>,
}

pub fn fill_polyfills(params: &mut FillPolyfillsParams<'_>) {
  let mut context = Context {
    visit_context: PolyfillVisitContext {
      program: params.program,
      top_level_context: params.top_level_context,
      top_level_decls: params.top_level_decls,
    },
    searching_polyfills: params.searching_polyfills,
    found_polyfills: params.found_polyfills,
  };

  visit_children(context.visit_context.program.as_node(), &mut context);
}

fn visit_children(node: Node, context: &mut Context) {
  if context.searching_polyfills.is_empty() {
    return;
  }

  for child in node.children() {
    visit_children(child, context);
  }

  for i in (0..context.searching_polyfills.len()).rev() {
    if context.searching_polyfills[i].visit_node(node, &context.visit_context) {
      // move the searching polyfill over to the found one
      let found_polyfill = context.searching_polyfills.remove(i);
      context.found_polyfills.push(found_polyfill);
    }
  }
}
